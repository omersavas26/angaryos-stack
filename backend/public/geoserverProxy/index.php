<?php

/****    Common Variables    ****/

$data = [];
$env = [];
$dbConnection = NULL;


/****    Helper Functions    ****/

require 'helpers.php';


/****  Main  ****/

$data = require 'control.php';
if($data == NULL) return;

$env = getEnvironments();

$cqlFilter = getCqlFilterFromCache();
if(!$cqlFilter) return;

$url = getUrlWithCqlFilter($cqlFilter);
return proxyToUrl($url); 

?>