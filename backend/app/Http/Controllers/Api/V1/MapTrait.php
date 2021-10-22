<?php

namespace App\Http\Controllers\Api\V1;

use Gate;
use DB;
use Cache;
use Storage;

trait MapTrait
{
    private function fillAuthFunctions()
    {
        $rules = 
        [
            'viewAny', 
            'view',           
            'create',         
            'update',
            'delete',
            'archive',
            'restore',
            'restored',
            'deleted',
            'export',
            'cloneRecord',
            'columnSetOrArrayIsPermitted',
            
            'columnIsPermittedForQuery',
            'columnIsPermittedForList',
            'treeIsPermittedForRelationTableData',
        ];
        
        foreach($rules as $rule)
            Gate::define($rule, 'App\Policies\UserPolicy@'.$rule);
    }
    
    private function GetTableNameAndCacheNameFromRequestWMS($requests)
    {
        if(isset($requests['LAYERS'])) $key = 'LAYERS';
        else if(isset($requests['LAYER'])) $key = 'LAYER';
        else custom_abort('layer(s).param.not.found');

        $tableName = explode(':', $requests[$key])[1];
        
        if(substr($tableName, 0, 2) == 'v_')
            $tableName = substr($tableName, 2);
        
        return ['tableName' => $tableName, 'cacheName' => $tableName];
    }
    
    private function GetTableNameAndCacheNameFromRequestWFS($requests)
    {
        $seoName = explode(':', $requests['TYPENAME'])[1];
        $table =$this->getTableFromCustomLayerSeoName($seoName);
        
        return ['tableName' => $table->name, 'cacheName' => $seoName];
    }
    
    private function GetTableNameAndCacheNameFromRequest($requests)
    {
        $type = strtolower($requests['SERVICE']);
        switch($type)
        {
            case 'wms': return $this->GetTableNameAndCacheNameFromRequestWMS($requests);
            case 'wfs': return $this->GetTableNameAndCacheNameFromRequestWFS($requests);
            default: dd('buraya hiç düşmemeli!');
        }
    }
    
    private function AddFilterInRequest($user, $requests) 
    {
        $names = $this->GetTableNameAndCacheNameFromRequest($requests);   
        $token = \Request::segment(3);
        
        if(!isset($user->auths['filters'][$names['tableName']]['list'])) 
        {
            $key = 'userToken:'.$token.'.tableName:'.$names['cacheName'].'.mapFilters';
            Cache::remember($key, 60 * 60, function()
            {
                return 'OK';
            });
            
            return $requests;
        }
        
        $filter = '';
        $filterIds = $user->auths['filters'][$names['tableName']]['list'];
        foreach($filterIds as $filterId)
        {
            $sqlCode = get_attr_from_cache('data_filters', 'id', $filterId, 'sql_code');
            $sqlCode = str_replace('TABLE.', '', $sqlCode); 
            $sqlCode = urlencode($sqlCode);
            
            $filter .= '%20and%20'.$sqlCode;
        }
        $filter = substr($filter, 9);
        
        Cache::remember('userToken:'.$token.'.tableName:'.$names['cacheName'].'.mapFilters', 60 * 60, function() use($filter)
        {
            return $filter;
        });
        
        if(isset($requests['CQL_FILTER']))
            $requests['CQL_FILTER'] .= '%20and%20'.$filter;
        else
            $requests['CQL_FILTER'] = $filter;
        
        return $requests;
    }

    private function UserMapAuthControl($user)
    {
        if(!isset($user->auths['map'][0][0]))
            custom_abort("no.map.auth");
    }

    private function UserKmzUploadAuthControl($user)
    {
        $this->UserMapAuthControl($user);
        
        if(!isset($user->auths['map']['kmz']['upload']))
            custom_abort("no.map.kmz.upload.auth");
    }
    
    private function GetDataAuthControl($user, $requests)
    {
        $this->UserMapAuthControl($user);

        $type = strtolower($requests['SERVICE']);
        
        switch($type)
        {
            case 'wms': return $this->AuthControlWms($user, $requests);
            case 'wfs': return $this->AuthControlWfs($user, $requests);
            default: custom_abort ('undefined.service.type.'.$type);
        }
    }
    
    private function getTableFromCustomLayerSeoName($seoName)
    {
        $key = 'customLayerSeoName:'.$seoName.'|returnData:table_id';
        $tableId = (int)Cache::rememberForever($key, function() use($seoName)
        {      
            $customLayers = DB::table('custom_layers')->get();
            foreach($customLayers as $customLayer)
                if(helper('seo', $customLayer->name) == $seoName)
                    return $customLayer->table_id;
        });        
        if($tableId == 0) custom_abort ('undefined.layer_name: ' . $seoName);
        
        $table = get_attr_from_cache('tables', 'id', $tableId, '*');
        if(!$table) custom_abort ('undefined.layer_name: ' . $seoName);
        
        return $table;
    }
    
    private function AuthControlWfs($user, $requests) 
    {
        if(!isset($requests['TYPENAME'])) custom_abort ('undefined.TYPENAME.data');
        
        $temp = explode(':', $requests['TYPENAME']);
        if(count($temp) != 2) 
            custom_abort ('undefined.LAYERS.data: ' . $requests['LAYERS']);
        
        $table = $this->getTableFromCustomLayerSeoName($temp[1]);
        
        if(!isset($user->auths['tables'][$table->name]['maps']))
            custom_abort ('no.auth.for.layer: ' . $layerName);

        $temp = $user->auths['tables'][$table->name]['maps'];
        if(!in_array(0, $temp) && !in_array(1, $temp))
            custom_abort ('no.auth.for.layer: ' . $layerName);
    }
    
    private function AuthControlWms($user, $requests) 
    {
        if(isset($requests['LAYERS'])) $key = 'LAYERS';
        else if(isset($requests['LAYER'])) $key = 'LAYER';
        else custom_abort('layer(s).param.not.found');

        $temp = explode(':', $requests[$key]);

        if(count($temp) != 2) 
            custom_abort ('undefined.LAYERS.data: ' . $requests[$key]);
        
        if(substr($temp[1], 0, 2) == 'v_')
        {
            $layerName = substr($temp[1], 2);
            
            if(!isset($user->auths['tables'][$layerName]['maps']))
                custom_abort ('no.auth.for.layer: ' . $layerName);

            $temp = $user->auths['tables'][$layerName]['maps'];
            if(!in_array(0, $temp) && !in_array(1, $temp))
                custom_abort ('no.auth.for.layer: ' . $layerName);
        }
        else
        {
            $control = FALSE;
            
            foreach($user->auths['custom_layers'] as $id => $t)
            {
                $layerName = get_attr_from_cache('custom_layers', 'id', $id, 'name');
                $layerName = helper('seo', $layerName);
                
                if($layerName == $temp[1])
                {
                    $control = TRUE;
                    break;
                }
            }
            
            if(!$control) custom_abort ('no.auth.for.layer: ' . $temp[1]);
        }
    }
    
    private function GetAllRequest() 
    {
        $temp = \Request::all();
        
        $requests = [];
        foreach($temp as $key => $value)
            $requests[strtoupper($key)] = $value;
        
        return $requests;
    }
    
    private function Control($user) 
    {
        $requests = $this->GetAllRequest();
        $this->GetDataAuthControl($user, $requests);
        $this->ServiceTypeControl($requests);
        
        return $requests;
    }
    
    private function ServiceTypeControl($requests) 
    {
        $type = strtolower(strtoupper(@$requests['SERVICE']));
        switch ($type) 
        {
            case 'wms': break;
            case 'wfs': break;
            default: custom_abort('undefined.service.type: ' . $type);
        }
    }
    
    private function GetUrl($requests)
    {
        $url = 'http://geoserver:8080/geoserver/'.env('GEOSERVER_WORKSPACE', 'angaryos').'/';
        $url .= strtolower($requests['SERVICE']).'?';
                
        foreach($requests as $key => $value) 
        {
            if($key != 'CQL_FILTER')
                $value = urlencode($value);
            
            $url .= $key.'='.$value.'&';
        }
        
        return $url;
    }
    
    private function GetImage($url)
    {
        $imginfo = getimagesize($url);
        
        header("Content-type: ".$imginfo['mime']);
        
        return readfile($url);
    }
    
    private function GetJsonData($url)
    {
        return file_get_contents($url);
    }
    
    private function ProxyToUrl($requests, $url)
    {
        $type = strtolower($requests['SERVICE']);
        switch($type)
        {
            case 'wms': return $this->GetImage($url);
            case 'wfs': return $this->GetJsonData($url);
        }
    }


    private function MoveUploadedFileToTempFolder($user, $file)
    {
        $tempFolder = 'temps/';
        $fileName = $user->id.'_'.$file->getClientOriginalName();
        $path = $tempFolder.$fileName;

        $file->move($tempFolder, $fileName);

        @chmod($path, 0777);

        return $path;
    }

    private function ExportKmlFromKmz($path)
    {
        $temp = explode('/', $path);
        $fileName = $temp[count($temp) - 1];
        $temp[count($temp) - 1] = str_replace('.kmz', '', $fileName);
        $exportPath = implode('/', $temp);

        $zip = new \ZipArchive;
        if ($zip->open($path) === TRUE) 
        {
            $zip->extractTo($exportPath);
            $zip->close();
        } 
        else
            custom_abort('can.not.open.kmz.file');

        return $exportPath . '/doc.kml';
    }

    private function GetDataArrayFromKmlOrKmzFile($path)
    {
        $temp = explode('.', $path);
        if(last($temp) == 'kmz')
            $path = $this->ExportKmlFromKmz($path);
        
        $xml_string = file_get_contents($path);
        $xml = simplexml_load_string($xml_string);
        $obj = json_encode($xml);
        return json_decode($obj, TRUE);
    }

    private function GetFeatureObjectFromKmlFeaturePoint($temp, $feature)
    {
        $temp['type'] = 'point';
        $temp['orgCoords'] = trim($feature['Point']['coordinates']);

        $coords = explode(',', $temp['orgCoords']);
        $temp['wkt'] = 'POINT('.$coords[0].' '.$coords[1].')';
        
        return $temp;
    }

    private function GetFeatureObjectFromKmlFeatureLineString($temp, $feature)
    {
        if(!isset($feature['LineString']['coordinates'])) return NULL;
            
        $temp['type'] = 'linestring';
        $temp['orgCoords'] = trim($feature['LineString']['coordinates']);
        
        $temp['wkt'] = 'LINESTRING(';
        $coords = explode(' ', $temp['orgCoords']);
        foreach($coords as $coord)
        {
            $point = explode(',', $coord);
            $temp['wkt'] .= $point[0] . ' ' . $point[1] . ', ';
        }

        if(count($coords) > 0)
            $temp['wkt'] = substr($temp['wkt'], 0, -2);

        $temp['wkt'] .= ')';

        return $temp;
    }

    private function GetFeatureObjectFromKmlFeaturePolygon($temp, $feature)
    {
        $coords = $feature['Polygon']['outerBoundaryIs'];
        if(is_array($coords)) $coords = $coords['LinearRing']['coordinates'];

        $temp['type'] = 'polygon';
        $temp['orgCoords'] = trim($coords);
        
        $temp['wkt'] = 'POLYGON((';
        $coords = explode(' ', $temp['orgCoords']);
        foreach($coords as $coord)
        {
            $point = explode(',', $coord);
            $temp['wkt'] .= $point[0] . ' ' . $point[1] . ', ';
        }

        if(count($coords) > 0)
            $temp['wkt'] = substr($temp['wkt'], 0, -2);

        $temp['wkt'] .= '))';

        return $temp;
    }

    private function GetFeatureObjectFromKmlFeatureDirectCoordinates($temp, $feature)
    {
        $temp['coords'] = trim($feature['coordinates']);
        
        if(strstr($feature['coordinates'], ' ')) $temp['type'] = 'linestring';
        else $temp['type'] = 'point';
        dd($temp);
        return $temp;
    }

    private function GetFeatureObjectFromKmlFeatureOuterBoundaryIs($temp, $feature)
    {
        $temp['coords'] = trim($feature['outerBoundaryIs']['LinearRing']['coordinates']);
        $temp['type'] = 'polygon';
        dd($temp);
        return $temp;
    }

    private function GetFeatureObjectFromKmlFeature($layerName, $feature)
    {
        $temp = [];
        //$temp['feature'] = $feature;
        $temp['layerName'] = $layerName;

        $temp['name'] = '';
        if(isset($feature['name'])) $temp['name'] = $feature['name'];

        if(isset($feature['Point']))
            return $this->GetFeatureObjectFromKmlFeaturePoint($temp, $feature);
        else if(isset($feature['LineString']))
            return $this->GetFeatureObjectFromKmlFeatureLineString($temp, $feature);
        else if(isset($feature['Polygon']))
            return $this->GetFeatureObjectFromKmlFeaturePolygon($temp, $feature);
        else if(isset($feature['coordinates']))
            return $this->GetFeatureObjectFromKmlFeatureDirectCoordinates($temp, $feature);
        else if(isset($feature['outerBoundaryIs']))
            return $this->GetFeatureObjectFromKmlFeatureOuterBoundaryIs($temp, $feature);
        else return NULL;
    }

    private function GetFeaturesFromFile($user, $file)
    {   
        $path = $this->MoveUploadedFileToTempFolder($user, $file);
        $data = $this->GetDataArrayFromKmlOrKmzFile($path);

        $data = $data['Document']['Folder'];
        if(isset($data['name'])) $temp = [$data];

        $features = [];
        foreach($data as $item)
        {  
            $layerName = $item['name'];
            $tempData = $item['Placemark'];
            foreach($tempData as $feature)
            {
                $temp = $this->GetFeatureObjectFromKmlFeature($layerName, $feature);
                if($temp == NULL) continue;

                array_push($features, $temp);
            }
        }

        return $features;
    }

    private function ConvertToTreeFromFeatures($features)
    {
        $tree = [];
        foreach($features as $feature)
        {
            if(!isset($tree[$feature['layerName']])) 
                $tree[$feature['layerName']] = [];

            if(!isset($tree[$feature['layerName']][$feature['type']])) 
                $tree[$feature['layerName']][$feature['type']] = [];

            array_push($tree[$feature['layerName']][$feature['type']], $feature);
        }

        return $tree;
    }
    
    private function geoTypeControl($type)
    {
        $types = ['point', 'linestring', 'polygon'];
        if(!in_array($type, $types))
            custom_abort ('invalid.geo.type:'.$type);
    }


    private function GetUserSubTables($user, $upTableName, $type)
    {
        $upTable = get_attr_from_cache('tables', 'name', $upTableName, '*');
        $subTables = DB::table('sub_tables')
                            ->whereRaw('table_ids @> \''.$upTable->id.'\'::jsonb or table_ids @> \'"'.$upTable->id.'"\'::jsonb')
                            ->get();
        
        $return = [];
        foreach($subTables as $subTable)
        {
            $table = get_model_from_cache('tables', 'id', $subTable->sub_table_id);
            $columns = $table->getRelationData('column_ids');
            foreach($columns as $column)
            {
                $columnTypeName = $column->getRelationData('column_db_type_id')->name;
                if(!strstr($columnTypeName, $type)) continue;
                
                $srid = $column->srid;
                if(strlen($srid) == 0) $srid = DB_PROJECTION;
                
                array_push($return, 
                [
                    'tableId' => $table->id,
                    'tableName' => $table->name,
                    'tableDisplayName' => $table->display_name,
                    'columnid' => $column->id,
                    'columnName' => $column->name,
                    'columnDisplayName' => $column->display_name,
                    'columnSrid' => $srid                    
                ]);
            }
        }
     
        return $return;   
    }
    
    private function getValidatedParamsForSearchGeoInMultiTables()
    {
        $params = read_from_response_data('params', TRUE);
       
        param_is_have($params, 'wkt');
        param_is_have($params, 'tables');
        
        foreach($params->tables as $i => $tableData)
        {
            param_is_have($tableData, 'name');
            param_is_have($tableData, 'column_array_id');
            param_is_have($tableData, 'column_array_id_query');
            
            param_value_is_correct($tableData, 'column_array_id', ['required', 'numeric']);
            param_value_is_correct($tableData, 'column_array_id_query', ['required', 'numeric']);
        }
        
        return $params;
    }
}
