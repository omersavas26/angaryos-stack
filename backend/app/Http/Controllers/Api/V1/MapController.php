<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\User;
use Event;
use Gate;

class MapController extends Controller
{
    use MapTrait;

    public function __construct()
    {
        //\Cache::flush();
    }  
    
    private function abort($message = 'no.auth')
    {
        custom_abort($message);
    }
    
    public function GetData($user)
    {
        send_log('info', 'Request Map Tile Or WFS Data');

        $requests = $this->Control($user);
        $requests = $this->AddFilterInRequest($user, $requests);
        
        $url = $this->GetUrl($requests);      
        return $this->ProxyToUrl($requests, $url);        
    }

    public function TranslateKmzOrKmlToJson($user)
    {
        send_log('info', 'Request Translate Kmz Or Kml File To Json');

        $this->UserKmzUploadAuthControl($user);
        
        $file = \Request::file('file');
        $features = $this->GetFeaturesFromFile($user, $file);  
        $tree = $this->ConvertToTreeFromFeatures($features);

        send_log('info', 'Response Translate Kmz Or Kml File To Json', $tree);

        return helper('response_success', $tree);
    }
    
    public function GetSubTables($user, $upTableName, $type)
    {
        send_log('info', 'Request Sub Tables '.$upTableName.':'.$type);
        
        $this->userMapAuthControl($user);
        $this->geoTypeControl($type);
        
        $subTables = $this->GetUserSubTables($user, $upTableName, $type);
        
        send_log('info', 'Response Sub Tables ', json_encode($subTables));

        return helper('response_success', $subTables);
    }
    
    public function searchGeoInMultiTables(User $user)
    {
        global $pipe;
        
        send_log('info', 'Request Search Geo In Multi Table');
        
        $this->fillAuthFunctions();
        
        $params = $this->getValidatedParamsForSearchGeoInMultiTables(); 
        foreach($params->tables as $tableData)
        {
            $pipe['table'] = $tableData->name;
            $tableData->sorts = helper('get_null_object');
            $tableData->filters = $tableData->sorts;
            if(Gate::denies('viewAny', $tableData)) $this->abort('no.auth.for.'.$tableData->name);
        }
                
        $data = Event::dispatch('record.searchGeoInMultiTables.requested', [$params])[0];
        
        send_log('info', 'Response Search Geo In Multi Table', [$params, $data]);
        
        return helper('response_success', $data);
    }
}
