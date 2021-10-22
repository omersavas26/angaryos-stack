<?php

namespace App\Listeners;

use App\Http\Requests\BaseRequest;

use App\Libraries\ChangeDataLibrary;
use App\Libraries\ColumnClassificationLibrary;

use App\Listeners\CacheSubscriber;

use DB;
use Auth;
use App\BaseModel;

trait TableSubscriberTrait 
{
    /****    List    ****/
    
    public function getDataForList($model, $params) 
    {
        global $pipe;
        
        $except = ['tables', 'columns'];
        
        $params = $this->getModelForList($model, $params);
        
        if(in_array($model->getTable(), $except) && $pipe['SHOW_DELETED_TABLES_AND_COLUMNS'] != '1')
            $params->model->where($model->getTable().'.name', 'not ilike', 'deleted\_%');
        
        $count = $params->model->count($params->table_name.'.id');
        
        $collectiveInfos = $model->getCollectiveInfos($params->model, $params->columns);
        
        $params->model->limit($params->limit);
        $params->model->offset($params->limit * ($params->page - 1));
        
        $records = $params->model->get();
        
        $tableInfo = $model->getTableInfo($params->table_name);
        
        $records = $model->updateRecordsDataForResponse($records, $params->columns);
        
        $records = $model->updateRecordsESignDataForResponse($records, $tableInfo, $params->columns);
        
        $columns = $model->getFilteredColumns($params->columns);
        
        $params->query_columns = $model->getColumns($model->getQuery(), 'column_arrays', $params->column_array_id_query);
        $queryColumns = $model->getFilteredColumns($params->query_columns);
        
        $records = $this->fillRecordCanInfos($records, $params->table_name);
        
        if($params->limit == 0)
            $pages = 0;
        else 
            $pages = (int)ceil($count / $params->limit);
        
        return 
        [
            'table_info' => $tableInfo,
            'records' => $records,
            'collectiveInfos' => $collectiveInfos, 
            'columns' => $columns,
            'query_columns' => $queryColumns,
            'pages' => $pages,
            'all_records_count' => $count
        ];
    }
    
    private function getColumnIdsFromColumnArray($model, $id)
    {
        $rt = [];
        if($id > 0)
        {
            $temp = get_attr_from_cache('column_arrays', 'id', $id, 'column_ids');
            $rt = json_decode($temp);
        }
        else
        {
            $allColumns = $model->getAllColumnsFromDB();
            foreach($allColumns as $column) array_push($rt, $column['id']);
        }
        
        return $rt;
    }    
    
    public function getDataForSearchGeoInMultiTables($params) 
    {
        $geoColumns = [];
        
        $return = [];
        foreach($params->tables as $tableData)
        {
            $model = new BaseModel($tableData->name);
            $allColumns = $model->getAllColumnsFromDB();
            $columnIds = $this->getColumnIdsFromColumnArray($model, $tableData->column_array_id);
            
            $tableData->table_name = $tableData->name;
            $tableData->limit = 50;
            $tableData->page = 1;
            
            foreach($allColumns as $col)
                if(in_array($col['id'], $columnIds) && strlen($col['srid']) > 0)
                {
                    $filter = helper('get_null_object');
                    $filter->type = 1;
                    $filter->guiType = 'multipolygon';
                    $filter->filter = json_encode([$params->wkt]);
                    $filter->description = '';
                    $tableData->filters->{$col['name']} = $filter;
                }
                
            $return[$tableData->name] = $this->listRequested($model, $tableData);
        }
        
        return $return;
    }
    
    public function getDataForQuickSearch($model, $params, $words) 
    {
        $types = ['string', 'text', 'jsonb', 'integer', 'float', 'datetime', 'date', 'time'];
        
        $words = explode(' ', $words);
        
        $params->limit = 3;
        $params->model = $model->getQuery();        
        $params->columns = $model->getColumns($params->model, 'column_arrays', $params->column_array_id);
        
        foreach($params->columns as $column)
        {
            $dbTypeName = get_attr_from_cache('column_db_types', 'id', $column->column_db_type_id, 'name');
            if(!in_array($dbTypeName, $types)) continue;
            
            $params->model->orWhere(function($query) use ($words, $column)
            {
                foreach($words as $word)
                    $query->whereRaw('"'.$column->name.'"'.'::text ilike \'%'.$word.'%\'');
            });
        }
        
        $count = $params->model->count($params->table_name.'.id');
        
        $params->model->limit($params->limit);
        $params->model->offset($params->limit * ($params->page - 1));
        $records = $params->model->get();
        
        $records = $model->updateRecordsDataForResponse($records, $params->columns);
        
        $tableInfo = $model->getTableInfo($params->table_name);
        
        $columns = $model->getFilteredColumns($params->columns);
        
        $records = $this->fillRecordCanInfos($records, $params->table_name);
        
        return 
        [
            'table_info' => $tableInfo,
            'records' => $records,
            'columns' => $columns,
            'pages' => (int)ceil($count / $params->limit),
            'all_records_count' => $count
        ];
    }
    
    public function getModelForList($model, $params)
    {
        $params->model = $model->getQuery();
        
        $params->columns = $model->getColumns($params->model, 'column_arrays', $params->column_array_id);
        
        $model->addJoinsWithColumns($params->model, $params->columns);
        $model->addSorts($params->model, $params->columns, $params->sorts);
        $model->addWheres($params->model, $params->columns, $params->filters);
        $model->addSelects($params->model, $params->columns);
        $model->addFilters($params->model, $params->table_name, 'list');
        
        $params->model->addSelect($params->table_name.'.id');
        
        $standartColumns = ['id', 'own_id', 'user_id', 'created_at', 'updated_at', 'state'];
        foreach($standartColumns as $columnName)
            $params->model->groupBy($params->table_name.'.'.$columnName);

        $exts = ['json', 'jsonb'];
        foreach($params->columns as $column) 
        {            
            if(isset($column->select_raw)) continue;

            $dbTypeName = get_attr_from_cache('column_db_types', 'id', $column->column_db_type_id, 'name');
            if(in_array($dbTypeName, $exts)) continue;
            
            $params->model->groupBy($params->table_name.'.'.$column->name);
        }
        
        return $params;
    }
    
    private function fillRecordCanInfos($records, $tableName)
    {
        $infos = 
        [
            '_is_restorable' => 'restore',
            '_is_deletable' => 'delete',
            '_is_editable' => 'edits',
            '_is_showable' => 'shows',
            '_is_exportable' => 'export',
        ];
        
        $auths = Auth::user()->auths['tables'][$tableName];
        
        foreach($records as $i => $record)
            foreach($infos as $columnName => $authPrefix)
            {
                if(!isset($auths[$authPrefix]))
                {
                    $records[$i]->{$columnName} = FALSE;
                    continue;
                }

                if(is_object($record))
                {
                    if(get_class($record) == 'stdClass')
                        $keys = array_keys((array)$record);
                    else
                        dd('fillRecordCanInfos66');//uzun süre buraya düşmezse else kısmını sil. bellki tüm kayıtlar DB::ile çekilip geliyor
                }
                
                if(in_array($columnName, $keys))
                {
                    if(strlen($records[$i]->{$columnName}) == 0) 
                        $records[$i]->{$columnName} = FALSE;

                    continue;
                }
                
                $records[$i]->{$columnName} = isset($auths[$authPrefix]);
            }
            
        return $records;
    }
    
    
    /****    Export    ****/
    
    public function getDataForExport($record)
    {
        global $pipe;
        
        return $this->getDataForExportRecursive($pipe['table'], $record);
    }
    
    private function getPipeKeysForExportRecursiveFunction($tableName, $record)
    {
        global $pipe;
        
        if(isset($record->id))
            $unique = $record->id;
        else if(isset($record->_source_column_name))
            $unique = $record->{$record->_source_column_name};
            
        $keys = ['getDataForExportRecursiveData', $tableName.':'.$unique];
        
        return $keys;
    }
    
    private function recursiveControlForGetDataForExportRecursiveFunction($tableName, $record)
    {
        if($tableName == 'columns')
            if($record->id < 100) 
                return FALSE;
            
        if($tableName == 'column_table_relations')
            if($record->id < 46) 
                return FALSE;
        
        return TRUE;
    }
    
    private function getDataForExportRecursive($tableName, $record, $recursive = TRUE)
    {
        global $pipe;
        
        $keys = $this->getPipeKeysForExportRecursiveFunction($tableName, $record);
        if(isset($pipe[$keys[0]][$keys[1]])) return $pipe[$keys[0]][$keys[1]];
     
        $return = 
        [
            'tableName' => $tableName,
            'columns' => [],
            'data' => []
        ];
        
        if(get_class($record) == 'App\BaseModel') $data = $record->toArray(); 
        else if(get_class($record) == 'stdClass') $data = (array)$record;        
        
        $table = new BaseModel('tables');
        $table = $table->where('name', $tableName)->first();
        
        if($table == NULL)
        {
            $return['data'] = $data;
        }
        else
        {
            $baseColumns = ['user_id', 'own_id', 'created_at', 'updated_at'];
            
            $columns = $table->getRelationData('column_ids');
            foreach($columns as $column)
                if(!in_array($column->name, $baseColumns))
                {
                    $recursive = $this->recursiveControlForGetDataForExportRecursiveFunction($tableName, $record);
                    if(!$recursive)
                    {
                        $return['data'][$column->name] = $data[$column->name];
                        continue;
                    }
                    
                    $tempColumn = $this->getDataForExportRecursive('columns', $column);
                    $return['columns'][$column->name] = $tempColumn;

                    if(get_class($record) == 'App\BaseModel')
                        $temp = $record->getRelationData($column->name);
                    else if(get_class($record) == 'stdClass') 
                        $temp = @$record->{$column->name};

                    $return['data'][$column->name] = $temp;

                    $params = helper('get_null_object');
                    $params->record = $record;
                    $params->column = $column;

                    if(strlen($column->column_table_relation_id) > 0)
                    {
                        $subTableName = ColumnClassificationLibrary::relation(
                                                $this, 
                                                'getTableNameForGetDataForExportRecursive', 
                                                $column, 
                                                NULL, 
                                                $params);
                        
                        $relation = get_model_from_cache('column_table_relations', 'id', $column->column_table_relation_id);
                        
                        if(is_object($temp))
                        {
                            $return['data'][$column->name] = $this->getDataForExportRecursive($subTableName, $temp);
                        
                            $relationTree = $this->getDataForExportRecursive('column_table_relations', $relation);
                            $return['data'][$column->name]['relation'] = $relationTree;
                        }
                        else if(is_array($temp))
                            foreach($temp as $i => $tempObject)
                            {
                                $return['data'][$column->name][$i] = $this->getDataForExportRecursive($subTableName, $tempObject);
                            
                                $relationTree = $this->getDataForExportRecursive('column_table_relations', $relation);
                                $return['data'][$column->name][$i]['relation'] = $relationTree;
                            }
                        
                        
                    }
                }
        }
        $pipe[$keys[0]][$keys[1]] = $return;
        
        return $return;
    }
    
    public function getTableNameForGetDataForExportRecursiveForTableIdAndColumnIds($params)
    {
        return get_attr_from_cache('tables', 'id', $params->relation->relation_table_id, 'name');
    }
    
    public function getTableNameForGetDataForExportRecursiveForRelationSql($params)
    {
        return helper('get_table_name_from_sql', $params->relation->relation_sql);
    }
    
    public function getTableNameForGetDataForExportRecursiveForDataSource($params)
    {
        $name = get_attr_from_cache('column_data_sources', 'id', $params->relation->column_data_source_id, 'name');
        return '[columnDataSources: '.$name.']';
    }
    
    public function getTableNameForGetDataForExportRecursiveForTableIdAndColumnNames($params)
    {
        return get_attr_from_cache('tables', 'id', $params->relation->relation_table_id, 'name');
    }
    
    
    
    /****    Archive    ****/
    
    public function getDataForArchive($record, $params) 
    {
        $params = $this->getModelForArchive($record, $params);
        
        $count = $params->model->count($params->table_name.'.id');
        
        $params->model->limit($params->limit);
        $params->model->offset($params->limit * ($params->page - 1));
        $records = $params->model->get();
        $records = $record->updateRecordsDataForResponse($records, $params->columns);
        
        $tableInfo = $record->getTableInfo($params->table_name);
        
        $columns = $record->getFilteredColumns($params->columns);
        
        $params->query_columns = $record->getColumns($record->getQuery(), 'column_arrays', $params->column_array_id_query);
        $queryColumns = $record->getFilteredColumns($params->query_columns);
        
        return 
        [
            'table_info' => $tableInfo,
            'records' => $records,
            'columns' => $columns,
            'query_columns' => $queryColumns,
            'pages' => (int)ceil($count / $params->limit),
            'all_records_count' => $count
        ];
    }
    
    public function getModelForArchive($record, $params)
    {
        $model = new BaseModel($record->getTable().'_archive');
        
        $params->model = $model->getQuery();
        
        $params->columns = $model->getColumns($params->model, 'column_arrays', $params->column_array_id);
        
        $model->addJoinsWithColumns($params->model, $params->columns);
        $model->addSorts($params->model, $params->columns, $params->sorts);
        $model->addWheres($params->model, $params->columns, $params->filters);
        $model->addSelects($params->model, $params->columns);
        
        $this->addFiltersForArchiveAndDeletedList($params->model, $params->table_name);
        
        $params->model->where($params->table_name.'.record_id', $record->id);
        
        $params->model->addSelect($params->table_name.'.id');
        $params->model->groupBy($params->table_name.'.id');
        
        return $params;
    }
    
    public function addFiltersForArchiveAndDeletedList($model, $tableName)
    {
        $tableName = str_replace('_archive', '', $tableName);
        
        $auths = Auth::user()->auths;
        
        if(!isset($auths['filters'])) return;
        if(!isset($auths['filters'][$tableName])) return;
        if(!isset($auths['filters'][$tableName]['list'])) return;
        
        $filters = $auths['filters'][$tableName]['list'];
        
        $model->leftJoin($tableName, DB::raw($tableName.'.id'), '=', DB::raw($tableName.'_archive.record_id'));
        
        foreach($filters as $filterId)
        {
            $sqlCode = get_attr_from_cache('data_filters', 'id', $filterId, 'sql_code');
            $sql = str_replace('TABLE', $tableName, $sqlCode);            
            $model->whereRaw($sql);
        }
    }
    
    
    
    /****    Deleted    ****/
    
    public function getDataForDeleted($params) 
    {
        $params = $this->getModelForDeleted($params);
        
        $count = $params->model->count($params->table_name.'.id');
        
        $params->model->limit($params->limit);
        $params->model->offset($params->limit * ($params->page - 1));
        $records = $params->model->get();
        $records = $params->recordModel->updateRecordsDataForResponse($records, $params->columns);
        
        $tableInfo = $params->recordModel->getTableInfo($params->table_name);
        
        $columns = $params->recordModel->getFilteredColumns($params->columns);
        
        $params->query_columns = $params->recordModel->getColumns($params->recordModel->getQuery(), 'column_arrays', $params->column_array_id_query);
        $queryColumns = $params->recordModel->getFilteredColumns($params->query_columns);
        
        return 
        [
            'table_info' => $tableInfo,
            'records' => $records,
            'columns' => $columns,
            'query_columns' => $queryColumns,
            'pages' => (int)ceil($count / $params->limit),
            'all_records_count' => $count
        ];
    }
    
    public function getModelForDeleted($params)
    {
        $params->recordModel = new BaseModel($params->table_name);
        
        $params->model = $params->recordModel->getQuery();
        
        $params->columns = $params->recordModel->getColumns($params->model, 'column_arrays', $params->column_array_id);
        
        $params->recordModel->addJoinsWithColumns($params->model, $params->columns);
        $params->recordModel->addSorts($params->model, $params->columns, $params->sorts);
        $params->recordModel->addWheres($params->model, $params->columns, $params->filters);
        $params->recordModel->addSelects($params->model, $params->columns);
        
        $this->addFiltersForArchiveAndDeletedList($params->model, $params->table_name);
        
        $tableName = substr($params->table_name, 0, -8);
        
        $params->model->whereRaw($params->table_name.'.record_id not in (select id from '.$tableName.')');
        
        $params->model->addSelect($params->table_name.'.id');
        $params->model->groupBy($params->table_name.'.id');
        
        return $params;
    }
    
    
    
    /****    Create    ****/
    
    public function getDataForCreate($model, $params) 
    {
        $params = $this->getModelForCreate($model, $params);        
        $tableInfo = $model->getTableInfo($params->table);        
        $columnSet = $model->getFilteredColumnSet($params->columnSet, TRUE);
        
        return 
        [
            'table_info' => $tableInfo,
            'column_set' => $columnSet,
            'gui_triggers' => $params->guiTriggers
        ];
    }
    
    public function getModelForCreate($model, $params)
    {
        $params->model = $model->getQuery();
        
        $params->columnSet = $model->getColumnSet($params->model, $params->column_set_id, TRUE);
        $params->columns = $model->getColumnsFromColumnSet($params->columnSet);
        $params->guiTriggers = $model->getGuiTriggers($params->columns);
        
        return $params;
    }
    
    public function getDataForSelectElement($params, $record)
    {
        $columnName = read_from_response_data('in_form_column_name');
        if(strlen($columnName) == 0) return;
        
        $singleColumnName = read_from_response_data('single_column');
        
        if(strlen($singleColumnName) > 0)
        {
            $column = get_attr_from_cache('columns', 'name', $singleColumnName, '*');
            $functionName = __FUNCTION__.'Single';
        }
        else
        {
            $column = get_attr_from_cache('columns', 'name', $columnName, '*');
            $functionName = __FUNCTION__;
        }
        
        if($column == NULL) return;
        
        $temp = helper('get_null_object');
        $temp->record = $record;
        $temp->params = $params;
        $temp->column = $column;

        return ColumnClassificationLibrary::relation($this, $functionName, $column, NULL, $temp);
    }
    
    public function getDataForSelectElementSingleForDataSource($params)
    {
        $val = $params->record{$params->column->name};
        
        $dataSource = get_attr_from_cache('column_data_sources', 'id', $params->relation->column_data_source_id, '*');
        
        $repository = NULL;
        eval(helper('clear_php_code', $dataSource->php_code));
        
        $display = $repository->getRecordsForListBySourceData($params->record, $params->column);
        
        return
        [
            'source' => '',
            'display' => $display
        ];
    }
    
    public function getDataForSelectElementSingleForTableIdAndColumnNames($params)
    {
        $val = $params->record{$params->column->name};
        
        $tableName = get_attr_from_cache('tables', 'id', $params->relation->relation_table_id, 'name');
        $sourceColumn = get_attr_from_cache('columns', 'name', $params->relation->relation_source_column, '*');
        $displayColumnName = $params->relation->relation_display_column;
               

        $params->tableName = $tableName;
        $params->sourceColumn = $sourceColumn;
        $params->displayColumnName = $displayColumnName;
        $params->val = $val;

        return ColumnClassificationLibrary::relationDbTypes(
                                                            $this, 
                                                            __FUNCTION__, 
                                                            $sourceColumn, 
                                                            $params->column, 
                                                            $params);
    }
    
    public function getDataForSelectElementSingleForTableIdAndColumnNamesForOneToOne($params)
    {
        $rec = DB::table($params->tableName)
                ->select($params->sourceColumn->name)
                ->addSelect($params->displayColumnName)
                ->where($params->sourceColumn->name, $params->val)
                ->first();
        
        return
        [
            'source' => $rec->{$params->sourceColumn->name},
            'display' => $rec->{$params->displayColumnName}
        ];
    }

    public function getDataForSelectElementSingleForTableIdAndColumnNamesForManyToOne($params)
    {
        $recs = DB::table($params->tableName)
                ->select(DB::raw($params->sourceColumn->name . ' as source'))
                ->addSelect(DB::raw($params->displayColumnName . ' as display'))
                ->whereIn($params->sourceColumn->name, $params->val)
                ->get();
           
        $r = [];
        foreach($params->val as $i => $id)
            foreach($recs as $rec)   
                if($rec->source == $id)
                {
                    $r[(string)($i+1)] = $rec;
                    break;
                }

        $r = json_encode($r);

        return
        [
            'source' => $r,
            'display' => $r
        ];
    }
    
    public function getDataForSelectElementSingleForTableIdAndColumnIds($params)
    {
        $val = $params->record{$params->column->name};
        
        $tableName = get_attr_from_cache('tables', 'id', $params->relation->relation_table_id, 'name');
        $sourceColumn = get_attr_from_cache('columns', 'id', $params->relation->relation_source_column_id, '*');
        $displayColumnName = get_attr_from_cache('columns', 'id', $params->relation->relation_display_column_id, 'name');
               

        $params->tableName = $tableName;
        $params->sourceColumn = $sourceColumn;
        $params->displayColumnName = $displayColumnName;
        $params->val = $val;

        return ColumnClassificationLibrary::relationDbTypes(
                                                            $this, 
                                                            __FUNCTION__, 
                                                            $sourceColumn, 
                                                            $params->column, 
                                                            $params);
    }

    public function getDataForSelectElementSingleForTableIdAndColumnIdsForOneToOne($params)
    {
        $rec = DB::table($params->tableName)
                ->select($params->sourceColumn->name)
                ->addSelect($params->displayColumnName)
                ->where($params->sourceColumn->name, $params->val)
                ->first();
        
        return
        [
            'source' => @$rec->{$params->sourceColumn->name},
            'display' => @$rec->{$params->displayColumnName}
        ];
    }

    public function getDataForSelectElementSingleForTableIdAndColumnIdsForManyToOne($params)
    {
        if($params->val == NULL) $params->val = [];
        
        $recs = DB::table($params->tableName)
                ->select(DB::raw($params->sourceColumn->name . ' as source'))
                ->addSelect(DB::raw($params->displayColumnName . ' as display'))
                ->whereIn($params->sourceColumn->name, $params->val)
                ->get();
           
        $r = [];
        foreach($params->val as $i => $id)
            foreach($recs as $rec)   
                if($rec->source == $id)
                {
                    $r[(string)($i+1)] = $rec;
                    break;
                }

        $r = json_encode($r);

        return
        [
            'source' => $r,
            'display' => $r
        ];
    }
    
    public function getDataForSelectElementSingleForBasicColumn($params)
    {
        return $this->getDataForSelectElementForBasicColumn($params);
    }

    private function getFirstJoinTableAliasForSelectColumn($relationTable)
    {
        if(is_string($relationTable->join_table_ids))
            $joinTableIds = json_decode($relationTable->join_table_ids);
        else
            $joinTableIds = $relationTable->join_table_ids;

        return get_attr_from_cache('join_tables', 'id', $joinTableIds[0], 'join_table_alias');
    }
    
    public function getDataForSelectElementSingleForJoinTableIds($params)
    {
        $params->tableName = get_attr_from_cache('tables', 'id', $params->relation->relation_table_id, 'name');
        
        $model = new BaseModel($params->tableName);
        $params->model = $model->getQuery();
        
        $model->addJoinsWithColumns($params->model, [$params->column], TRUE);
        

        $params->alias = $this->getFirstJoinTableAliasForSelectColumn($params->relation);

        $params->source = $params->relation->relation_source_column;
        if(!strstr($params->source, '.')) $params->source = $params->tableName.'.'.$params->source;
        
        $params->display = $params->relation->relation_display_column;
        if(!strstr($params->display, '.')) $params->display = $params->tableName.'.'.$params->display;

        $params->source = str_replace($params->alias.'.', $params->tableName.'.', $params->source);
        $params->display = str_replace($params->alias.'.', $params->tableName.'.', $params->display);

        return ColumnClassificationLibrary::relationDbTypes(
                                                            $this, 
                                                            __FUNCTION__, 
                                                            $params->column, 
                                                            NULL, 
                                                            $params);
    }

    public function getDataForSelectElementSingleForJoinTableIdsForOneToMany($params)
    {
        $params->model->addSelect(DB::raw($params->source.' as source'));
        $params->model->addSelect(DB::raw($params->display.' as display'));

        $params->model->whereIn($params->tableName.'.id', $params->record->{$params->column->name});
        
        $data = $params->model->get();

        $display = helper('get_null_object');
        $i = 1;
        foreach($params->record->{$params->column->name} as $id)
            foreach($data as $record)
                if($record->source == $id)
                {
                    $display->{$i++} = $record;
                    break;
                }

        return
        [
            'source' => '',
            'display' => json_encode($display)
        ];
    }

    public function getDataForSelectElementSingleForJoinTableIdsForOneToOne($params)
    {
        $params->model->addSelect(DB::raw($params->source.' as source'));
        $params->model->addSelect(DB::raw($params->display.' as display'));

        $params->model->where($params->tableName.'.id', $params->record->{$params->column->name});
        
        $data = $params->model->first();
        
        return $data;
    }

    public function getDataForSelectElementSingleForRelationSql($params)
    {
        $source = $params->record->{$params->column->name};
        if($source == NULL) return['source' => '', 'display' => ''];

        if(is_string($source))
        {
            if(strlen($source) == 0) return['source' => '', 'display' => ''];

            $sql = $params->relation->relation_sql;
            $sql = 'select * from ('.$sql.') as data where '.$params->relation->relation_source_column.' = ' .$source;
        }
        else if(is_array($source))
        {
            if(count($source) == 0) return['source' => '', 'display' => ''];

            $sql = $params->relation->relation_sql;
            $sql = 'select * from ('.$sql.') as data ';
            
            $temp = '';
            foreach($source as $s)
            {
                if(strlen(trim($s)) == 0) continue;
                
                $temp .= $s . ', ';
            }

            //Bundan tam emin değilim adam tümünü getirmek istiyor olabilir mi?
            //Yada tümünü istemek için tüm id leri gönderiyor da olabilir.
            if($temp == '') return['source' => '', 'display' => ''];

            $temp = substr($temp, 0, -2);

            $sql .= 'where '.$params->relation->relation_source_column.' in ( '.$temp.')';
        }
        else dd('beklenmedik tip');
        
        $record = DB::select($sql)[0];

        return
        [
            'source' => $record->{$params->relation->relation_source_column},
            'display' => $record->{$params->relation->relation_display_column}
        ];
    }
    
    public function getDataForSelectElementForTableIdAndColumnIds($params)
    {
        $sourceColumnName = get_attr_from_cache('columns', 'id', $params->relation->relation_source_column_id, 'name');
        $sourceColumnName = helper('reverse_clear_string_for_db', $sourceColumnName); 
        
        $displayColumnName = get_attr_from_cache('columns', 'id', $params->relation->relation_display_column_id, 'name');
        $displayColumnName = helper('reverse_clear_string_for_db', $displayColumnName); 
        
        return
        [
            'source' => $params->record{$sourceColumnName},
            'display' => $params->record{$displayColumnName}
        ];
    }

    public function getDataForSelectElementForTableIdAndColumnNames($params)
    {
        $source = $params->relation->relation_source_column;
        $source = helper('reverse_clear_string_for_db', $source); 
         
        $display = $params->relation->relation_display_column;
        $display = helper('reverse_clear_string_for_db', $display); 
        
        $temp = new BaseModel($params->record->getTable());
        $temp = $temp->selectRaw('*, ('.$display.') as tempdisplay');
        $temp = $temp->where($source, $params->record{$source})->first();

        return
        [
            'source' => $temp->{$source},
            'display' => $temp->tempdisplay
        ];
    }
    
    public function getDataForSelectElementForBasicColumn($params)
    {
        $data = $params->record{$params->column->name};
        
        $dbTypeName = get_attr_from_cache('column_db_types', 'id', $params->column->column_db_type_id, 'name');
        switch($dbTypeName)
        {
            case 'boolean': 
                $data = ($data == '1');
                break;
            default: break;
        } 
        
        return
        [
            'source' => $params->record{$params->column->name},
            'display' => $data
        ];
    }
    
    public function getDataForSelectElementForRelationSql($params)
    {
        return
        [
            'source' => $params->record{$params->relation->relation_source_column},
            'display' => $params->record{$params->relation->relation_display_column}
        ];
    }
    
    public function getDataForSelectElementForDataSource($params)
    {
        //test auths
        //https://192.168.10.185/api/v1/c8n1zcgR1Uet6D4md1/tables/auth_groups/store?name_basic=ccc&in_form_column_name=auths&state=1&column_set_id=0&auths=%5B%22tables:departments:lists:2%22,%22tables:departments:lists:0%22%5D&#
        
        $dataSource = get_attr_from_cache('column_data_sources', 'id', $params->relation->column_data_source_id, '*');
        $repository = NULL;
        eval(helper('clear_php_code', $dataSource->php_code));
        return $repository->getDataForSelectElement($params->record);
    }
    
    public function getDataForSelectElementForJoinTableIds($params)
    {
        $model = new BaseModel($params->record->getTable());
        $params->model = $model->getQuery();
        
        $model->addJoinsWithColumns($params->model, [$params->column], TRUE);
        
        $sourceColumn = $params->relation->relation_source_column;
        if(!strstr($sourceColumn, '.'))
                $sourceColumn = $params->record->getTable().'.'.$sourceColumn;
        
        $displayColumn = $params->relation->relation_display_column;
        if(!strstr($sourceColumn, '.'))
                $displayColumn = $params->record->getTable().'.'.$displayColumn;
        
        $params->model->addSelect(DB::raw($sourceColumn.' as source'));
        $params->model->addSelect(DB::raw($displayColumn.' as display'));
        
        
        $params->model->whereRaw($params->record->getTable().'.id = '.$params->record->id);
        
        $data = $params->model->first();
        
        return
        [
            'source' => $data->source,
            'display' => $data->display
        ];
    }
    
    
    
    /****    Store    ****/
    
    public function createNewRecord($dataArray, $tableName = NULL)
    {
        if($tableName == NULL)
        {
            global $pipe;
            $tableName = $pipe['table'];
        }
        $dataArray = (Object)$dataArray;
        
        global $pipe;
        if(isset($pipe['overrideRequestDatas']))
            foreach($pipe['overrideRequestDatas'] as $columnName => $columnData)
                $dataArray->{$columnName} = $columnData;
        
        return create_new_record($tableName, $dataArray);
    }
    
    public function validateRecordData($dataArray)
    {
        $dataArray['column_set_id'] = 0;
        
        \Request::merge($dataArray);
        $request = app('App\Http\Requests\BaseRequest');
        return $request->validator->errors()->getMessages();
    }
    
    
    
    /****    Update    ****/
    
    public function updateRecord($record, $dataArray)
    {
        $record->fillVariables();
        
        global $pipe;
        if(isset($pipe['overrideRequestDatas']))
            foreach($pipe['overrideRequestDatas'] as $columnName => $columnData)
                $dataArray->{$columnName} = $columnData;
        
        $keys = array_keys($record->toArray());
        if(!in_array('column_set_id', $keys))
            unset($dataArray->column_set_id);
        
        $columns = $record->getAllColumnsFromDB();
        
        if(copy_record_to_archive($record))
        {
            $helper = new ChangeDataLibrary();
            $record = $helper->updateData($columns, $dataArray, $record);
        }
        else
            custom_abort('record.not.copy.top.archive');
        
        $user = \Auth::user();
        if($user == NULL) $user = \App\User::find(ROBOT_USER_ID);

        $record->user_id = $user->id;
        
        $record->save();
        
        return $record;
    }
    
    
    
    /****    Edit    ****/
    
    public function getDataForEdit($model, $params) 
    {
        $params = $this->getModelForEdit($model, $params);
        
        $tableInfo = $model->getTableInfo($params->table);
        
        $columnSet = $model->getFilteredColumnSet($params->columnSet, TRUE);
        $columnSet = $this->filterColumnsForSingleColumnForm($columnSet, @$params->single_column_name);
        
        
        $record = $params->model->first();

        $record = $model->updateRecordsDataForResponse($record, $params->columns);
        
        $record = $this->replaceRelationColumnDataForForm($model, $record, $columnSet);

        $record = $this->filterRecordsColumnWithColumns([$record], $columnSet)[0];
        
        return 
        [
            'table_info' => $tableInfo,
            'record' => $record,
            'column_set' => $columnSet,
            'gui_triggers' => $params->guiTriggers,
        ];
    }
    
    public function filterColumnsForSingleColumnForm($columnSet, $singleColumnName)
    {
        if(strlen($singleColumnName) == 0) return $columnSet;
        
        $clone = helper('clone_object_as_array', $columnSet);
        
        $control = FALSE;
        
        foreach($columnSet->column_arrays as $columnArrayId => $columnArray)
            foreach($columnArray->columns as $columnId => $column) 
            {
                if($column->name == $singleColumnName)
                    $control = TRUE;
                else
                    unset($clone['column_arrays'][$columnArrayId]['columns'][$columnId]);
            }
                
        if(!$control) custom_abort ('no.auth.for.column.'.$singleColumnName);
        
        return helper('clone_object', $clone);
    }
    
    public function getModelForEdit($model, $params)
    {
        $params->model = $model->getQuery();
        $params->model->addSelect($model->getTable().'.*');

        $params->columnSet = $model->getColumnSet($params->model, $params->column_set_id, TRUE);
        $params->columns = $model->getColumnsFromColumnSet($params->columnSet);
        
        $params->guiTriggers = $model->getGuiTriggers($params->columns);
        
        $model->addJoinsWithColumns($params->model, $params->columns);
        
        $model->addFilters($params->model, $params->table, 'update');        
        $params->model->where($params->table.'.id', $model->id);        
        $params->model->groupBy($params->table.'.id');
        
        return $params;
    }
    
    private function replaceRelationColumnDataForForm($model, $record, $columnSet)
    {
        $dataClasses = ['stdClass', 'App\BaseModel'];
        
        $data = (array)$record;
        
        foreach($columnSet->column_arrays as $columnArray)
            foreach($columnArray->columns as $column) 
                if(strlen($column->column_table_relation_id) > 0)
                {
                    $relationData = $model->getRelationData($column->name);

                    $class = @get_class($relationData); 
                    if(in_array($class, $dataClasses))
                        $relationData = [$relationData];
                    
                    $data[$column->name] = [];
                    if(is_array($relationData))
                        foreach($relationData as $r)
                            array_push($data[$column->name], [
                                'source' => $r->_source_column,
                                'display' => $r->_display_column
                            ]);
                }
        
        $data['id'] = $model->id;
                    
        return $data;
    }
    
    
    
    /****    Delete    ****/
    
    public function deleteRecord($record)
    {
        $record->fillVariables();
        $except = ['tables', 'columns'];
        
        if(copy_record_to_archive($record))
        {
            if(in_array($record->getTable(), $except))
            {
                DB::table($record->getTable())->where('id', $record->id)->update([
                    'name' => 'deleted_'.$record->name
                ]);
                return TRUE;
            }
            else if($record->delete())
                return TRUE;
        }
        
        return FALSE;
    }
    
    
    
    /****    Show    ****/
    
    public function getDataForShow($model, $params) 
    {
        $params = $this->getModelForShow($model, $params);
        
        $tableInfo = $model->getTableInfo($params->table);
        
        $columnSet = $model->getFilteredColumnSet($params->columnSet);
        
        $record = $params->model->first();
        if($record == NULL) custom_abort ('no.auth.for.this.record');
        
        $record = $model->updateRecordsDataForResponse($record, $params->columns);
        
        return 
        [
            'table_info' => $tableInfo,
            'record' => $record,
            'column_set' => $columnSet
        ];
    }
    
    public function getModelForShow($model, $params)
    {
        $params->model = $model->getQuery();
        
        $params->columnSet = $model->getColumnSet($params->model, $params->column_set_id);
        $params->columns = $model->getColumnsFromColumnSet($params->columnSet);
        
        $model->addJoinsWithColumns($params->model, $params->columns);
        
        $model->addSelects($params->model, $params->columns);
        $params->model->addSelect($params->table.'.id');
        
        $model->addFilters($params->model, $params->table, 'show');
        
        $params->model->where($params->table.'.id', $model->id);
        
        $params->model->groupBy($params->table.'.id');
        
        return $params;
    }
    
    
    
    /****    Restore    ****/
    
    public function restoreRecord($archiveRecord, $record = NULL)
    {
        $archiveRecord->fillVariables();
        $tableName = substr($archiveRecord->getTable(), 0, -8);
        
        if($record != NULL)
        {
            $temp = new BaseModel($tableName);
            $record = $temp->find($record->id);
            
            $control = copy_record_to_archive($record);
            if(!$control) return FALSE;
            
            $data = $archiveRecord->toArray();
            
            unset($data['record_id']);
            unset($data['id']);
            unset($data['created_at']);
            unset($data['own_id']);
            
            $data['user_id'] = \Auth::user()->id;
            $data['updated_at'] = \Carbon\Carbon::now();
            
            foreach($data as $key => $value)
            {
                if(substr($key, -15, 15) == '__relation_data') continue;                
                $record->{$key} = $value;
            }
        }
        else
        {
            $data = $archiveRecord->toArray();
            
            $data['id'] = $data['record_id'];
            unset($data['record_id']);
            
            $data['user_id'] = \Auth::user()->id;
            $data['updated_at'] = \Carbon\Carbon::now();
            
            $createdAt = DB::table($archiveRecord->getTable())
                    ->select('created_at')
                    ->where('record_id', $data['id'])
                    ->orderBy('created_at')
                    ->first()->created_at;
            $data['created_at'] = $createdAt;
            
            if(isset($data['remote_record_ids'])) unset($data['remote_record_ids']);
            if(isset($data['disable_data_entegrates'])) unset($data['disable_data_entegrates']);

            $record = new BaseModel($tableName, $data);
        }

        $record->save();
        return $record;
    }   
    
    
    
    /****    Auth Assign    ****/
    
    private function authAssign($params)
    {
        if($params['all_user']) 
            return $this->addAuthWithUserList('*', $params['auth_id']);
        
        
        $userIds = $params['user_ids'];

        $temp = DB::table('users')->whereIn('department_id', $params['department_ids'])->get();
        $userIds = $this->mergeUserIdsList($userIds, $temp);

        if(count($userIds) > 0) $this->addAuthWithUserList($userIds, $params['auth_id']);
        
        if(count($params['auths']) > 0 ) $this->addAuthWithAuthGruoupsList($params['auths'], $params['auth_id']);        
    }
    
    private function mergeUserIdsList($base, $new)
    {
        foreach($new as $u)
            if(!in_array($u->id, $base))
                array_push($base, $u->id);
            
        return $base;
    }
    
    private function addAuthWithAuthGruoupsList($authGroupIds, $authId)
    {
        $cacheSubscriber = new CacheSubscriber(TRUE);
        foreach($authGroupIds as $authGroupId)
        {
            $authGroup = get_attr_from_cache('auth_groups', 'id', $authGroupId, '*');
            $temp = json_decode($authGroup->auths);
            
            if(in_array($authId, $temp) || in_array('"'.$authId.'"', $temp)) continue;
            
            copy_record_to_archive($authGroup, 'auth_groups');
            
            $sql = 'UPDATE auth_groups SET auths  = auths || \'["'.$authId.'"]\'::jsonb ';
            $sql .= ' where id = '.$authGroupId.'';

            DB::select($sql);
            $cacheSubscriber->recordChangedSuccess('auth_group', $authGroup, 'update');
        }
    }
    
    private function addAuthWithUserList($userIds, $authId)
    {
        $model = DB::table('users');
        if($userIds != '*') $model = $model->whereIn('id', $userIds);
        $users = $model->get();

        foreach($users as $user)
            copy_record_to_archive($user, 'users');
        
        $inSql = 'select id from users where auths @> \'"'.$authId.'"\'::jsonb or auths @> \''.$authId.'\'::jsonb';
        
        $sql = 'UPDATE users SET auths  = auths || \'["'.$authId.'"]\'::jsonb ';
        $sql .= ' where id not in ('.$inSql.') ';
        
        if($userIds != '*') $sql .= ' and id in ('.implode(',', $userIds).')';
        
        DB::select($sql);
        
        
        $sql = 'UPDATE users SET auths  = \'["'.$authId.'"]\'::jsonb where (auths::text = \'\') IS NOT FALSE';
        if($userIds != '*') $sql .= ' and id in ('.implode(',', $userIds).')';  
        
        DB::select($sql);      


        $model = DB::table('users');
        if($userIds != '*') $model = $model->whereIn('id', $userIds);
        $users = $model->get();
        
        $cacheSubscriber = new CacheSubscriber(FALSE);

        foreach($users as $user)
            $cacheSubscriber->recordChangedSuccess('users', $user, 'update');
    }



    /****    Common    ****/

    private function filterRecordsColumnWithColumns($records, $columnSet)
    {
        $return = [];

        foreach($records as $record)
        {
            if(is_array($record)) $record = (object)$record;

            $temp = [];
            $temp['id'] = $record->id;

            foreach($columnSet->column_arrays as $columnArray)
                foreach($columnArray->columns as $columnName => $column)
                    $temp[$columnName] = $record->{$columnName};

            array_push($return, $temp);
        }
        
        return $return;
    }
}