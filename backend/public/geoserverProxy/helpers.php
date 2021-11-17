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

function proxyToUrl($url)
{
    if(strstr($url, 'SERVICE=WFS')) return proxyToWfsUrl($url);
    else if(strstr($url, 'SERVICE=WMS')) return proxyToWmsUrl($url);
    else exit("tanimsiz.servis");
}

function proxyToWfsUrl($url, $deep = 5)
{
    $f = @readfile($url);
    if($f) return $f;
    else
    {
        if($deep < 0) exit("wfs.data.okunamadi");
        sleep(0.1);
        return proxyToWfsUrl($url, $deep-1);
    }
}

function proxyToWmsUrl($url, $deep = 5)
{
    $type = explode('&', explode('FORMAT=', $url)[1])[0];
    if(strlen($type) == 0) $type = 'image/png';

    header("Content-type: ".$type);

    $f = @readfile($url);
    if($f) return $f;
    else
    {
        if($deep < 0) exit("wms.data.okunamadi");
        
        sleep(0.1);
        return proxyToWmsUrl($url, $deep-1);
    }  
}

?>