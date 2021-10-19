<?php

namespace App\Http\Controllers\Api\V1;

use App\Libraries\ColumnClassificationLibrary;

use App\BaseModel;
use Gate;
use DB;

trait TableTrait
{
    /****    Base Functions    ****/
    
    private function abort($message = 'no.auth')
    {
        custom_abort($message);
    }
    
    private function pipeOperations()
    {
        global $pipe;
        
        unset($pipe['overrideRequestDatas']);
        
        if(@$pipe['testing'] || !isset($pipe['table']))//For data entegrator
            $pipe['table'] = helper('get_table_name_from_url');
    }
    
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
    
    private function columnIsAuthorized($column_name, $type)
    {
        $type = ucfirst(strtolower($type));
        
        if(Gate::denies('columnIsPermittedFor'.$type, $column_name))
            $this->abort('no.auth.column.'.$column_name.'.for.'.strtolower($type));
        
        return TRUE;
    }
    
    
        
    /****    Parameter Operations    ****/
    
    private function getValidationErrors($validator)
    {
        $temp = $validator->errors()->getMessages();
        if(count($temp) == 0) return NULL;
        
        $data['message'] = 'error';
        $data['errors'] = $temp;
        return helper('response_success', $data);
    }
    
    private function getValidatedParamsForArchive()
    {
        $params = read_from_response_data('params', TRUE);
        
        param_is_have($params, 'column_array_id');
        param_is_have($params, 'column_array_id_query');
        param_is_have($params, 'limit');
        param_is_have($params, 'page');
        
        $this->validateSorts($params);
        
        $this->validateFilters($params);
        
        global $pipe;
        $params->table_name = $pipe['table'].'_archive';
        
        return $params;
    }
    
    private function getValidatedParamsForDeleted()
    {
        $params = read_from_response_data('params', TRUE);
        
        param_is_have($params, 'column_array_id');
        param_is_have($params, 'column_array_id_query');
        param_is_have($params, 'limit');
        param_is_have($params, 'page');
        
        $this->validateSorts($params);
        
        $this->validateFilters($params);
        
        global $pipe;
        $params->table_name = $pipe['table'].'_archive';
        
        return $params;
    }
    
    private function getValidatedParamsForQuickSearch()
    {
        global $pipe;
        
        $params = helper('get_null_object');
        $params->column_array_id = read_from_response_data('column_array_id');
        
        $params->page = (int)read_from_response_data('page');
        if($params->page < 1) $params->page = 1;
        
        param_is_have($params, 'column_array_id');
        $params->table_name = $pipe['table'];
        
        return $params;
    }
    
    private function getValidatedParamsForList()
    {
        $params = read_from_response_data('params', TRUE);
        
        param_is_have($params, 'column_array_id');
        param_is_have($params, 'column_array_id_query');
        param_is_have($params, 'limit');
        param_is_have($params, 'page');
        
        $this->validateSorts($params);
        
        $this->validateFilters($params);
        
        global $pipe;
        $params->table_name = $pipe['table'];
        
        return $params;
    }
    
    private function validateSorts($params)
    {
        param_is_have($params, 'sorts');
        foreach($params->sorts as $name => $value)
        {
            $this->columnIsAuthorized($name, 'list');
                    
            if(!is_bool($value))
                $this->abort('uncorrect.param.'.$name);
        }
    }
    
    private function validateFilters($params)
    {
        param_is_have($params, 'filters');
        foreach($params->filters as $name => $value)
        {
            if($name == 'record_id') continue;
            
            param_value_is_correct($value, 'type', ['required', 'numeric']);

            $this->columnIsAuthorized($name, 'query');
            
            if($value->type != 100 && $value->type !=101)
            {
                param_is_have($value, 'filter');
                
                param_value_is_correct(
                    [$name => $value->filter],
                    $name,
                    ['required', '*auto*']);
            }
        }
    }

    private function validateSortsForRelationTableData($params)
    {
        $cols = json_decode($params->column_array->column_ids);

        param_is_have($params, 'sorts');
        foreach($params->sorts as $name => $value)
        {
            $colId = get_attr_from_cache('columns', 'name', $name, 'id');
            if(!in_array($colId, $cols)) $this->abort('no.auth.column.'.$name.'.for.relation.table.list');
                                
            if(!is_bool($value))
                $this->abort('uncorrect.param.'.$name);
        }
    }

    private function validateFiltersForRelationTableData($params)
    {
        $cols = json_decode($params->column_array->column_ids);

        param_is_have($params, 'filters');
        foreach($params->filters as $name => $value)
        {
            if($name == 'record_id') continue;
            
            param_value_is_correct($value, 'type', ['required', 'numeric']);

            $colId = get_attr_from_cache('columns', 'name', $name, 'id');
            if(!in_array($colId, $cols)) $this->abort('no.auth.column.'.$name.'.for.relation.table.query');
            
            if($value->type != 100 && $value->type !=101)
            {
                param_is_have($value, 'filter');

                param_value_is_correct(
                    [$name => $value->filter],
                    $name,
                    ['required', '*auto*']);
            }
        }
    }

    private function getValidatedParamsForListForRelationTableData($tree)
    {
        $params = read_from_response_data('params', TRUE);
        
        $tree = explode(':', $tree);

        $params->column_array_id = $tree[1];
        $params->column_array = get_attr_from_cache('column_arrays', 'id', $tree[1], '*');

        param_is_have($params, 'column_array_id');
        param_is_have($params, 'column_array_id_query');
        param_is_have($params, 'limit');
        param_is_have($params, 'page');
        
        $this->validateSortsForRelationTableData($params);
        
        $this->validateFiltersForRelationTableData($params);
        
        global $pipe;
        $params->table_name = $pipe['table'];
        
        return $params;
    }
    
    private function getValidatedParamsForRelationTableData($tree)
    {
        $params = $this->getValidatedParamsForListForRelationTableData($tree);
        
        global $pipe;
        $pipe['relation_table_data_request'] = TRUE;
        
        return $params;
    }
    
    private function getValidatedParamsForShow()
    {
        global $pipe;
        
        $params = read_from_response_data('params', TRUE);
        
        param_is_have($params, 'column_set_id');
        
        $params->table = $pipe['table'];
        
        return $params;
    }
    
    private function getValidatedParamsForCreate()
    {
        global $pipe;
        
        $params = read_from_response_data('params', TRUE);
        
        param_is_have($params, 'column_set_id');
        
        $params->table = $pipe['table'];
        
        return $params;
    }
    
    private function getValidatedParamsForEdit()
    {
        return $this->getValidatedParamsForCreate();
    }
    
    public function getValidatedParamsForStore($request, $isRequestArray = FALSE)
    {
        global $pipe;
        
        $params = helper('get_null_object');
            
        if($isRequestArray)
            $params->request = (Object)$request;
        else
            $params->request = (Object)$request->all();
        
        param_is_have($params->request, 'column_set_id');
        
        $model = new BaseModel($pipe['table']);
        $params->columnSet = $model->getColumnSet($model, (int)$params->request->column_set_id, TRUE);
        $params->columns = $model->getColumnsFromColumnSet($params->columnSet);

        
        $temp = $model->getFilteredColumnSet($params->columnSet, TRUE);
        $temp = $model->getColumnsFromColumnSet($temp);
        $temp = array_keys((array)$temp);
        
        $arr['column_set_id'] = $params->request->column_set_id;
        foreach($params->request as $key => $value)
            if(in_array($key, $temp))
                $arr[$key] = helper('clear_string_for_db', $value);
        
        if(isset($params->request->single_column))
            $arr['single_column_name'] = $params->request->single_column;
        
        $params->request = (Object)$arr;
        
        $params->table = new BaseModel('tables');

        $params->table = $params->table->where('name', $pipe['table'])->first();

        return $params;
    }
    
    public function getValidatedParamsForUpdate($request, $isRequestArray = FALSE)
    {
        $params = $this->getValidatedParamsForStore($request, $isRequestArray);
        return $params;
    }
    
    private function getValidatedParamsForSelectColumnDataInRelationTableData($tree, $column) 
    {
        $tree = explode(':', $tree);
        $columnIds = get_attr_from_cache('column_arrays', 'id', $tree[1], 'column_ids');
        $columnIds = json_decode($columnIds);
        if(!in_array($column->id, $columnIds))
            return $this->abort('column.not.in.table');
        
        $search = read_from_response_data('search');
        if(strlen($search) == 0) return $this->abort('search.is.null');
        if($search == '***') $search = '';
        
        $page = (int)read_from_response_data('page');
        if($page < 1) $page = 1;
        
        $return = helper('get_null_object');
        $return->page = $page;
        $return->search = $search;
        
        return $return;
    }
    
    public function getValidatedParamsForSelectColumnData($table, $column) 
    {
        $columns = $table->getAllColumnsFromDB();
        if(!isset($columns[$column->name]) || !is_array($columns[$column->name])) return $this->abort('column.not.in.table');
        
        $search = read_from_response_data('search');
        if(strlen($search) == 0) return $this->abort('search.is.null');
        if($search == '***') $search = '';
        
        $page = (int)read_from_response_data('page');
        if($page < 1) $page = 1;
        
        $limit = (int)read_from_response_data('limit');
        if($limit < 1) $limit = REC_COUNT_PER_PAGE;
        if($limit > 500) $limit = 500;
        
        $this->columnIsAuthorized($column->name, 'query');
        
        $return = helper('get_null_object');
        $return->page = $page;
        $return->search = $search;
        $return->limit = $limit;
        
        
        $return->table = $table;
        
        $return->upColumnName = read_from_response_data('upColumnName');
        $return->upColumnData = read_from_response_data('upColumnData');
        
        $return->currentFormData = read_from_response_data('currentFormData');        
        if(strlen($return->currentFormData) > 0) 
        {
            $return->currentFormData = str_replace('&#34;', '"', $return->currentFormData);
            $return->currentFormData = urldecode($return->currentFormData);
            $return->currentFormData = json_decode($return->currentFormData);
        }
        
        $editRecordId = read_from_response_data('editRecordId');
        if(strlen($editRecordId) > 0)
            $return->upColumnDataRecord = get_attr_from_cache($table->getTable(), 'id', $editRecordId, '*');
        
        if(strlen($return->upColumnName) > 0 && strlen($return->upColumnData) == 0 && strlen($editRecordId) > 0)
            $return->upColumnData = @$return->upColumnDataRecord->{$return->upColumnName};
        
        return $return;
    }
    
    private function getValidatedParamsForTableGroupByData($columnName)
    {
        $this->columnIsAuthorized($columnName, 'list');
        
        $params = (array)read_from_response_data('upData', TRUE);
        if(count(array_keys($params)) == 0) return [];
        
        foreach($params as $columnName => $data)
        {
            param_value_is_correct(
                    [$columnName => $data],
                    $columnName,
                    ['*auto*']);
        }
        
        return $params;
    }
    
    
    
    /****    Data Functions    ****/    
    
    private function getSelectColumnDataForTableIdAndColumIds ($params)
    {
        dd('asdasdasdasdasdasdasda');
        $table = $params->relation->getRelationData('relation_table_id');
        $source_column = $params->relation->getRelationData('relation_source_column_id');
        $display_column = $params->relation->getRelationData('relation_display_column_id');
        
        $model = DB::table($table->name)
                ->select($source_column->name)
                ->addSelect($display_column->name)
                ->where($display_column->name, 'ilike' ,'%'.$params->data['search'].'%')
                ->orderBy($source_column->name);
        
        $params->count = $model->count();
        $params->records = $model->limit($params->record_per_page)->offset(($params->data['page'] - 1) * $params->record_per_page)->get();
        
        $params->relation_source_column_name = $source_column->name;
        $params->relation_display_column_name = $display_column->name;
        return $this->getSelectColumnDataFromRecords($params);
    }
    
    private function getRecordDataForClone($record)
    {
        $cloneData = $record->toArray();
        
        unset($cloneData['id']);
        unset($cloneData['own_id']);
        unset($cloneData['user_id']);
        unset($cloneData['created_at']);
        unset($cloneData['updated_at']);
        
        return $cloneData;
    }
    
    private function exportAsFile($table, $record, $data)
    {
        $fileName = 'export.'.$table->getTable().'.'.$record->id.'.json';
        $params = 
        [
            'data' => $data,
            'fileName' => $fileName,
            'fullPath' => 'temps/'.$fileName,
            'headers' => ['Content-Type: application/json'],
        ];
        
        return helper('response_as_file', $params);
    }

    private function UpdateInFormDataReverseClearStringForDB($inFormData)
    {
        if(getType($inFormData) == 'object') $inFormData = (array)$inFormData;
        
        $inFormData['source'] = helper('reverse_clear_string_for_db', $inFormData['source']);
        $inFormData['display'] = helper('reverse_clear_string_for_db', $inFormData['display']);

        return $inFormData;
    }
}
