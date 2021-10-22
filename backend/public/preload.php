<?php

header("Access-Control-Allow-Origin: *");

/****    Global Functions    ****/

function getMemcachedKeys($host = 'memcached', $port = 11211)
{
    $mem = @fsockopen($host, $port);
    if ($mem === FALSE) return -1;

    // retrieve distinct slab
    $r = @fwrite($mem, 'stats items' . chr(10));
    if ($r === FALSE) return -2;

    $slabs = [];
    while (($l = @fgets($mem, 1024)) !== FALSE) 
    {
        // sortie ?
        $l = trim($l);
        if ($l == 'END') break;

        $m = array();
        // <STAT items:22:evicted_nonzero 0>
        $r = preg_match('/^STAT\sitems\:(\d+)\:/', $l, $m);
        if ($r != 1) return -3;
        
        if(!in_array($m[1], $slabs)) array_push ($slabs, $m[1]);
    }

    $keys = [];
    foreach($slabs as $slab)
    {
        $r = @fwrite($mem, 'lru_crawler metadump '.$slab . chr(10));
        while (($l = @fgets($mem, 1024)) !== FALSE) 
        {
            // key=angaryos_cache:b39efed6f405d9a00d43b2e6f311148aa7403250 exp=1586378101 la=1586378046 cas=106160 fetch=yes cls=2 size=119
            $l = trim($l);
            if ($l == 'END') break;
            
            $key = explode(' ', $l);
            $key = $key[0];
            $key = substr($key, 4);
            $key = urldecode($key);
            array_push($keys, $key);
        }
     
    }
    
    @fclose($mem);
    unset($mem);

    return $keys;
}

function getMemcachedData($key, $prefix = 'angaryos_cache:', $host = 'memcached', $port = 11211)
{
    $mem = @fsockopen($host, $port);
    if ($mem === FALSE) return -1;

    $r = @fwrite($mem, 'get  ' . $prefix.$key . chr(10));
    if ($r === FALSE) return -2;

    $arr = [];
    while (($l = @fgets($mem, 1024)) !== FALSE) 
    {   $l = trim($l);
        if ($l == 'END') break;
        
        array_push($arr, $l);
    }
        
    @fclose($mem);
    unset($mem);

    if(count($arr) == 0) return FALSE;
    else if($arr[1] == 'OK') return 'OK';
    else bb(
            'hiç filtre yok ise 1. eleman OK geliyor onu return ettim.'.
            'filtre olunca yine birinci eleman muhtemelen filtre olarak gelecek onu da bi incele öyle return et. '.
            ' istersen direk false dönerek laravel fw e geçirebilirsin reqyesti'
            , $arr);
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

define('BASE_PATH', '/var/www/backend/');
$pipe['logRandom'] = date('dymHis').rand(100, 500);
$pipe['laravelStart'] = microtime(true);
$pipe['addedJoins'] = [];