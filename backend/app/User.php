<?php

namespace App;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

use Cache;
use DB;

class User extends Authenticatable
{
    use Notifiable;
    
    private $tableGroups;
    
    protected $fillable = 
    [
        'tc', 'name', 'surname', 'email', 'password', 'location'
    ];
    
    protected $hidden = 
    [
        'password', 
        'remember_token', 
        'mobil_cihaz_uuid',
        'password_md5',
    ];

    protected $casts = 
    [
        'email_verified_at' => 'datetime',
        'tokens' => 'array',
        'auths' => 'array'
    ];
    
    protected $authTree;


    
    private function getTableGroups()
    {
        if($this->tableGroups == NULL)
        {
            $ids = @$this->auths['table_groups'][0][0];
            if($ids == NULL) $ids = [];
            
            $cacheKey = 'user:'.$this->id.'|tableGroups';
            
            $this->tableGroups = Cache::rememberForever($cacheKey, function() use($ids)
            {
                $rt = [];
                
                $tableGroups = DB::table('table_groups')->whereIn('id', $ids)->get();
                foreach($ids as $order => $id)
                    foreach($tableGroups as $tableGroup)
                        if($tableGroup->id == $id)
                            $rt[$order] = $tableGroup;
                        
                return $rt;
            });
        }
            
        return $this->tableGroups;
    }
    
    private function getTableGruop($tableId)
    {
        foreach($this->getTableGroups() as $tableGroup)
        {
            if(strlen($tableGroup->table_ids) == 0) continue;
            
            $tableIds = json_decode($tableGroup->table_ids);
            if(in_array($tableId, $tableIds))
                return $tableGroup;
        }
    }
    
    private function getTableListForMenu()
    {
        $return = [];
                
        if(isset($this->auths['tables']) && is_array($this->auths['tables']))
            foreach($this->auths['tables'] as $name => $auth)
            {
                if(isset($auth['option']) && in_array('0', $auth['option']))//menu hide
                    continue;

                $temp['id'] = get_attr_from_cache('tables', 'name', $name, 'id');
                if($temp['id'] == NULL) continue;
                
                $temp['name'] = $name;
                
                $temp['display_name'] = get_attr_from_cache('tables', 'name', $name, 'display_name');
                $temp['display_name'] = helper('reverse_clear_string_for_db', $temp['display_name']);

                $temp['link_description'] = get_attr_from_cache('tables', 'name', $name, 'link_description');
                $temp['link_description'] = helper('reverse_clear_string_for_db', $temp['link_description']);

                $tableGroup = $this->getTableGruop($temp['id']);
                if($tableGroup != NULL)
                    $groupId= $tableGroup->id;
                else
                    $groupId = 0;
                
                if(!isset($return[$groupId]))
                    $return[$groupId] = [];
                
                array_push($return[$groupId], $temp);
            }
            
        return $return;
    }
    
    private function getTableGroupListForMenu($tables)
    {
        $tableGroups = [];
        foreach($this->getTableGroups() as $tableGroup)
        {
            $temp = 
            [
                'id' => $tableGroup->id,
                'name_basic' => $tableGroup->name_basic,
                'table_ids' => json_decode($tableGroup->table_ids),
                'image' => @helper('get_url_from_file', json_decode($tableGroup->image))[0],
                'icon' => $tableGroup->icon,
            ];
            array_push($tableGroups, $temp);
        }

        $temp = 
        [
            'id' => 0,
            'name_basic' => 'Diğer',
            'table_ids' => [],
            'image' => '2020/01/01/other.png',
            'icon' => 'zmdi-aspect-ratio',
        ];

        if(isset($tables[0]))
            foreach($tables[0] as $table) 
                array_push($temp['table_ids'], $table['id']);
        
        array_push($tableGroups, $temp);

        return $tableGroups;
    }
    
    public function getMenuArray()
    {
        $tables = $this->getTableListForMenu();
        $tableGroups = $this->getTableGroupListForMenu($tables);
        $additionalLinks = $this->getAdditionalLinks();

        return 
        [
            'tables' => $tables,
            'tableGroups' => $tableGroups,
            'additionalLinks' => $additionalLinks
        ];
    }

    public function getAdditionalLinks()
    {
        if(!isset($this->auths['additional_links'])) return [];
        
        $links = [];
        foreach($this->auths['additional_links'][0][0] as $id)
        {
            $link = get_attr_from_cache('additional_links', 'id', $id, '*');
            unset($link->state);
            unset($link->own_id);
            unset($link->user_id);
            unset($link->created_at);
            unset($link->updated_at);
            
            $link->name_basic = helper('reverse_clear_string_for_db', $link->name_basic); 
            $link->link_description = helper('reverse_clear_string_for_db', @$link->link_description); 
            $link->payload = helper('reverse_clear_string_for_db', $link->payload);  
            array_push($links, $link);
        }
        
        return $links;
    }
    
    public function getReportsArray()
    {
        $return = [];
        
        if(isset($this->auths['reports']) && is_array($this->auths['reports']))
            foreach($this->auths['reports'] as $tableName => $reports)
            {
                foreach($reports as $reportId => $temp)
                {
                    $report = get_attr_from_cache('reports', 'id', $reportId, '*');
                    $reportTypeName = get_attr_from_cache('report_types', 'id', $report->report_type_id, 'name');
                    
                    $data = 
                    [
                        'table_name' => $tableName,
                        'id' => $reportId,
                        'name' => $report->name,                            
                        'type' => $reportTypeName
                    ];
                    
                    if(!isset($return[$tableName])) $return[$tableName] = [];
                    if(!isset($return[$tableName][$reportTypeName])) $return[$tableName][$reportTypeName] = [];
                    
                    array_push($return[$tableName][$reportTypeName], $data);
                }
            }
        
        return $return;
    }
    
    private function getLayerInfo($tableName, $tableAuth)
    {
        $info['base_url'] = '';
        $info['display_name'] = get_attr_from_cache('tables', 'name', $tableName, 'display_name');        
        $info['display_name'] = helper('reverse_clear_string_for_db', $info['display_name']);
        
        $info['legend_url'] = get_attr_from_cache('tables', 'name', $tableName, 'legend_url');
        if(strlen($info['legend_url']) == 0)
        {
            $info['legend_url'] = env('APP_URL').'api/v1/***token***/getMapData?SERVICE=wms&REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&';
            $info['legend_url'] .= 'WIDTH=***width***&HEIGHT=***height***&LAYER='.env('GEOSERVER_WORKSPACE').'%3Av_'.$tableName;
        }
        
        $info['workspace'] = env('GEOSERVER_WORKSPACE', 'angaryos');
        $info['layer_name'] = 'v_'.$tableName;
        $info['tableName'] = $tableName;
        $info['type'] = 'wms';
        $info['style'] = '';
        $info['period'] = '0';
        
        $info['filter'] = FALSE;
        $info['search'] = FALSE;
        $info['layerAuth'] = FALSE;
        
        if(in_array(0, $tableAuth))
        {
            $info['filter'] = TRUE;
            $info['search'] = TRUE;
            $info['layerAuth'] = TRUE;
        }
        else
        {
            if(in_array(3, $tableAuth)) $info['filter'] = TRUE;
            if(in_array(2, $tableAuth)) $info['search'] = TRUE;
            if(in_array(1, $tableAuth)) $info['layerAuth'] = TRUE;
        }
        
        $info['layerTableType'] = 'default';
        
        return $info;
    }
    
    private function getExternalLayerInfo($layer)
    {
        $info['base_url'] = $layer->layer_base_url;
        $info['display_name'] = $layer->name;
        $info['display_name'] = helper('reverse_clear_string_for_db', $info['display_name']);
        
        $temp = explode(':', $layer->layer_name);
        
        $info['workspace'] = $temp[0];
        $info['layer_name'] = $temp[1];
        $info['type'] = get_attr_from_cache('custom_layer_types', 'id', $layer->custom_layer_type_id, 'name');
        
        
        $info['style'] = get_attr_from_cache('layer_styles', 'id', $layer->layer_style_id, 'name');
        $info['style'] = helper('seo', $info['style']);
        
        if($info['type'] == 'wfs' && strlen($info['style']) > 0) 
            $info['style'] = get_attr_from_cache('layer_styles', 'id', $layer->layer_style_id, 'style_code');
               
        
        $info['period'] = $layer->period;
        if(strlen($info['period']) == 0) $info['period'] = 0;
        
        $info['filter'] = FALSE;
        $info['search'] = TRUE;
        $info['layerAuth'] = TRUE;
        
        $info['srid'] = $layer->srid;
        
        $info['legend_url'] = $layer->legend_url;
        
        $info['layerTableType'] = 'external';

        $info['relationTables'] = [];
        if(strlen($layer->table_ids) > 0)
        {
            foreach(json_decode($layer->table_ids) as $tableId)
                if(strlen($tableId) > 0)
                    array_push($info['relationTables'], get_attr_from_cache('tables', 'id', $tableId, 'name'));
        }
        
        return $info;
    }
    
    private function getCustomLayerInfo($layer)
    {
        $info['base_url'] = '';           
        $info['display_name'] = helper('reverse_clear_string_for_db', $layer->name);

        $info['workspace'] = env('GEOSERVER_WORKSPACE', 'angaryos');
        $info['layer_name'] = helper('seo', $layer->name);
        $info['type'] = get_attr_from_cache('custom_layer_types', 'id', $layer->custom_layer_type_id, 'name');
        
        $info['style'] = get_attr_from_cache('layer_styles', 'id', $layer->layer_style_id, 'name');
        $info['style'] = helper('seo', $info['style']);
        
        if($info['type'] == 'wfs' && strlen($info['style']) > 0) 
            $info['style'] = get_attr_from_cache('layer_styles', 'id', $layer->layer_style_id, 'style_code');
        
        $info['period'] = $layer->period;
        if(strlen($info['period']) == 0) $info['period'] = 0;
        
        $info['filter'] = FALSE;
        $info['search'] = FALSE;
        $info['layerAuth'] = TRUE;

        $info['legend_url'] = $layer->legend_url;
        if(strlen($info['legend_url']) == 0)
        {
            $info['legend_url'] = env('APP_URL').'api/v1/***token***/getMapData?SERVICE=wms&REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&';
            $info['legend_url'] .= 'WIDTH=***width***&HEIGHT=***height***&LAYER='.env('GEOSERVER_WORKSPACE').'%3A'.$info['layer_name'];
            $info['legend_url'] .= '&STYLE='.$info['style'];
        }
        
        $info['tableName'] = get_attr_from_cache('tables', 'id', $layer->table_id, 'name');
        $info['layerTableType'] = 'custom';
        
        return $info;
    }
    
    public function getMapArray()
    {
        if(!isset($this->auths['tables'])) return [];
        
        $mapAuths = [];
        $workspace = env('GEOSERVER_WORKSPACE', 'angaryos');
        
        foreach($this->auths['tables'] as $tableName => $table)            
            if(isset($table['maps']))
            {
                $info = $this->getLayerInfo($tableName, $table['maps']);
                $mapAuths[$info['workspace'].'__'.$info['layer_name']] = $info;
            }
       
        if(isset($this->auths['external_layers']))
            foreach($this->auths['external_layers'] as $id => $temp)  
            {
                $layer = get_attr_from_cache('external_layers', 'id', $id, '*');
                
                $temp = $this->getExternalLayerInfo($layer);
                $name = str_replace(':', '__', $layer->layer_name);

                $mapAuths[$name] = $temp;
            }
            
        if(isset($this->auths['custom_layers']))
            foreach($this->auths['custom_layers'] as $id => $temp)  
            {
                $layer = get_attr_from_cache('custom_layers', 'id', $id, '*');

                $temp = $this->getCustomLayerInfo($layer);
                $name = env('GEOSERVER_WORKSPACE', 'angaryos').'__'.helper('seo', $layer->name);

                $mapAuths[$name] = $temp;
            }
        
        return $mapAuths;
    }
    
    public function getDashboardArray()
    {
        if(!isset($this->auths['dashboards'])) return [];
        
        return $this->auths['dashboards'];
    }
    
    public function getAuthRecursive($ids)
    {
        if($ids == null) return [];
        
        $i = 0;
        while(count($ids) >= $i + 1)
        {
            if(is_numeric($ids[$i]))
            {
                $temp = get_attr_from_cache ('auth_groups', 'id', $ids[$i], 'auths');
                $temp = json_decode($temp);
                
                $temp = $this->getAuthRecursive($temp);
                
                unset($ids[$i]);
                $i--;
                
                $ids = array_merge($ids, $temp);
            }
            
            $i++;
        }
        
        return $ids;
    }
    
    private function getAuthTree($auths)
    {
        $tree = [];
        foreach($this->getAuthRecursive($auths) as $auth)
        {
            $a = explode(':', $auth);
            if(!isset($tree[$a[0]][$a[1]][$a[2]])) 
                $tree[$a[0]][$a[1]][$a[2]] = [];
            
            if(in_array($a[3], $tree[$a[0]][$a[1]][$a[2]])) continue;
            
            array_push($tree[$a[0]][$a[1]][$a[2]], $a[3]);
        }
        
        return $tree;
    }
    
    public function getAuthsAttribute($auths)
    {
        if(!$this->authTree)
        {
            $cacheName = 'tableName:users|id:'.$this->id.'|authTree';
            $this->authTree = Cache::rememberForever($cacheName, function() use($auths)
            {      
                $auths = json_decode($auths);
                $tree = $this->getAuthTree($auths);
                
                foreach($tree['tables'] as $name => $data)
                    $tree['tables'][$name]['display_name'] = get_attr_from_cache('tables', 'name', $name, 'display_name');
                
                return $tree;
            });
        }
        
        return $this->authTree;
    }
    
    public function toSafeArray()
    {
        $importantColumns = 
        [
            'password',
            'mobil_cihaz_uuid',
            'password_md5',
            'email_verified_at',
            'tokens',
            'remember_token',
            'user_id',
            'own_id',
            'created_at',
            'updated_at',
            'location',
            'state',
            'auths'
        ];
        
        $user = $this->toArray();
        
        foreach($importantColumns as $column)
        {
            unset($user->{$column});
            unset($user[$column]);
        }
            
        return $user;
    }
}