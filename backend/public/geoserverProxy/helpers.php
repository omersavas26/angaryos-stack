<?php

function bb(...$o)
{
    if(count($o) == 1) $o = $o[0];    
    echo json_encode($o);
    exit(0);
}

function getEnvironments()
{
    $env = [];
    
    $fn = fopen('./../.env','r');
    while($result = fgets($fn))
    {
        if(strlen($result) == 0) continue;
        if(!strstr($result, '=')) continue;
        
        $temp = explode('=', $result);
        $env[$temp[0]] = str_replace("\n", '', $temp[1]);
    }
    fclose($fn);
    
    return $env;
}

function getCqlFilterFromCache()
{
    global $data;
    
    $key = 'userToken:'.$data['segments'][3].'.tableName:'.$data['tableName'].'.mapFilters';
    return getMemcachedData($key);
}

function getUrlWithCqlFilter($filter)
{
    global $env, $data;

    if($filter == 'OK') $filter = '';
    
    if(strlen($filter) > 0)
    {
        if(isset($data['requests']['CQL_FILTER']))
            $data['requests']['CQL_FILTER'] .= '+AND+'.$filter;
        else
            $data['requests']['CQL_FILTER'] = $filter;
    }
    
    $url = 'http://geoserver:8080/geoserver/'.trim($env['GEOSERVER_WORKSPACE']).'/';
    $url .= strtolower($data['requests']['SERVICE']).'?';

    foreach($data['requests'] as $key => $value)       
        $url .= $key.'='.$value.'&';

    return $url;
}

function proxyToImage($url)
{
    $imginfo = getimagesize( $url );
    header("Content-type: ".$imginfo['mime']);
    return readfile( $url );
}

?>