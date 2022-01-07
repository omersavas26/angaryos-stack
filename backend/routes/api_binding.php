<?php

use \App\BaseModel;
use \App\User;

Route::bind('token', function ($token) 
{
    $user = helper('get_user_from_token', $token);    
    if($user == NULL) abort(helper('response_error', 'fail.token'));

    Auth::login($user);

    return $user;
});

Route::bind('deviceToken', function ($token) 
{
    $device = helper('get_device_from_token', $token);    
    if($device == NULL) abort(helper('response_error', 'fail.token'));

    return $device;
});

Route::bind('table_name', function ($tableName) 
{
    $tableId = get_attr_from_cache('tables', 'name', $tableName, 'id');
    if($tableId == NULL) abort(helper('response_error', 'fail.table.name'));

    $model = new BaseModel($tableName);

    return $model;
});

Route::bind('column_name', function ($columnName) 
{
    $column = new BaseModel('columns');
    $column = $column->where('name', $columnName)->get();
    if(count($column) == NULL) abort(helper('response_error', 'fail.column.name'));
    
    return $column[0];
});

Route::bind('id', function ($id) 
{    
    if(!is_numeric($id)) abort(helper('response_error', 'fail.id'));
    
    global $pipe;    
    
    $model = new BaseModel($pipe['table']);
    $model = $model->find($id);
    
    if($model == NULL) abort(helper('response_error', 'fail.id'));
    
    return $model;
});

Route::bind('archive_id', function ($id) 
{
    if(!is_numeric($id)) abort(helper('response_error', 'fail.archive_id'));
    
    global $pipe;
    
    $tableName = $pipe['table'];
    if(!strstr($tableName, '_archive')) $tableName .= '_archive';

    $model = new BaseModel($tableName);
    $model = $model->find($id);
    
    if($model == NULL) abort(helper('response_error', 'fail.archive_id'));
    
    return $model;
});

Route::bind('mission', function ($id) 
{
    if(!is_numeric($id)) abort(helper('response_error', 'fail.mission_id'));
    
    global $pipe;
    
    $model = new BaseModel('missions');
    $model = $model->find($id);
      
    if($model == NULL) abort(helper('response_error', 'fail.mission_id'));
    
    return $model;
});