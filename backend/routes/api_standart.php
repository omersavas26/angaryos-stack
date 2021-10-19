<?php

header('Access-Control-Allow-Origin: *');
header("Access-Control-Allow-Headers: X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
if (@$_SERVER['REQUEST_METHOD'] == "OPTIONS") die();

//Route::options('/{any}', '\App\Http\Controllers\GeneralController@serviceOk');

Route::any('/', '\App\Http\Controllers\GeneralController@serviceOk');
Route::post('/initializeDb', '\App\Http\Controllers\GeneralController@initializeDb');
Route::get('/upgradeDb', '\App\Http\Controllers\GeneralController@upgradeDb');

    
Route::post('login', 'AuthController@login');
Route::any('deviceLogin', 'AuthController@deviceLogin');

Route::group(['prefix' => 'device/{deviceToken}'], function ()
{
      
});

Route::group(['prefix' => '{token}'], function ()
{
    require 'api_binding.php';

    
    Route::any('test', '\App\Http\Controllers\GeneralController@test');
    
    
    Route::any('eSignControl', 'eSignController@control');
    
    
    Route::get('logs', '\App\Http\Controllers\GeneralController@logs');
    
    Route::any('/', '\App\Http\Controllers\GeneralController@serviceOk');
    Route::any('getLoggedInUserInfo', 'AuthController@getLoggedInUserInfo');
    Route::post('getUserToken/{user_id}', 'AuthController@getUserToken');
    
    Route::any('logOut', 'AuthController@LogOut');
    
    Route::post('assignAuth', 'AuthController@assignAuth');
    
    
    
    Route::post('getMapData', 'MapController@GetData');
    Route::post('translateKmzOrKmlToJson', 'MapController@TranslateKmzOrKmlToJson');
    Route::post('getSubTables/{upTableName}/{type}', 'MapController@GetSubTables');
    
    
    Route::post('importRecord', '\App\Http\Controllers\GeneralController@importRecord');

    
    
    Route::any('tables/{table_name}/report', 'ReportController@index');
    
    Route::any('missions/{mission}', 'MissionController@DoMission');
    
    Route::post('dashboards/getData/{auth}', 'DashboardController@GetData');
    
    Route::any('tables/{table_name}', 'TableController@index');
    Route::post('tables/{table_name}/deleted', 'TableController@deleted');
    Route::post('tables/{table_name}/create', 'TableController@create');
    
    //Route::options('tables/{table_name}/store', '\App\Http\Controllers\GeneralController@serviceOk');
    Route::any('tables/{table_name}/store', 'TableController@store');    
    
    Route::post('tables/{table_name}/{id}/edit', 'TableController@edit');
    
    //Route::options('tables/{table_name}/{id}/update', '\App\Http\Controllers\GeneralController@serviceOk');
    Route::any('tables/{table_name}/{id}/update', 'TableController@update');
    
    Route::post('tables/{table_name}/{id}/delete', 'TableController@destroy');
    Route::post('tables/{table_name}/{id}/clone', 'TableController@cloneRecord');
    Route::any('tables/{table_name}/{id}/export', 'TableController@export');
    Route::any('tables/{table_name}/{id}/archive', 'TableController@archive');
    Route::post('tables/{table_name}/{archive_id}/restore', 'TableController@restore');
    Route::post('tables/{table_name}/{id}', 'TableController@show');
    Route::post('tables/{table_name}/{id}/getRelationDataInfo/{column_name}', 'TableController@getRelationDataInfo'); 

    
    Route::post('tables/{table_name}/{id}/getRelationTableData/{tree}', 'TableController@getRelationTableData');
    
    
    Route::any('tables/{table_name}/getSelectColumnData/{column_name}', 'TableController@getSelectColumnData');
    Route::post('tables/{table_name}/{id}/getRelationTableData/{tree}/getSelectColumnData/{column_name}', 'TableController@getSelectColumnDataInRelationTableData');
    Route::post('tables/{table_name}/{id}/archive/getSelectColumnData/{column_name}', 'TableController@getSelectColumnDataInArchive');
    Route::post('tables/{table_name}/deleted/getSelectColumnData/{column_name}', 'TableController@getSelectColumnDataInDeleted');
    
    Route::any('tables/{table_name}/groupBy/{column_name}', 'TableController@getTableGroupByData');

    
    Route::post('columnGuiTriggers/{table_name}/{column_name}/{triggerName}', 'ColumnGuiTriggerController@index');
    
    Route::post('search/{table_name}/{words}', 'TableController@search');

});