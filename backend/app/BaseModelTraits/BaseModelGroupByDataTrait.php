<?php

namespace App\BaseModelTraits;

use App\Libraries\ColumnClassificationLibrary;
use App\BaseModel;
use DB;

trait BaseModelGroupByDataTrait 
{    
    private $deletables = ['tables', 'columns'];
    
    public function getGroupByData($params)
    {           
        return ColumnClassificationLibrary::relation(  $this, 
                                                        __FUNCTION__,
                                                        $this, 
                                                        NULL, 
                                                        $params);
    }
    
    public function getGroupByDataForBasicColumn($params)
    {
        global $pipe;
        
        $temp = helper('get_null_object');
        
        $temp->records = DB::table($pipe['table'])->select($this->name)->distinct();        
        foreach($params as $key => $val) $temp->records = $temp->records->where($key, $val);
        $temp->records = $temp->records->get();
        
        $temp->source_column_name = $this->name;
        $temp->display_column_name = $this->name;
        
        return $this->getGroupByDataFromRecords($temp);
    }

    /*private function getFirstJoinTableAliasForSelectColumn($relationTable)
    {
        if(is_string($relationTable->join_table_ids))
            $joinTableIds = json_decode($relationTable->join_table_ids);
        else
            $joinTableIds = $relationTable->join_table_ids;

        return get_attr_from_cache('join_tables', 'id', $joinTableIds[0], 'join_table_alias');
    }
    
    public function getSelectColumnDataForJoinTableIds($params)
    {
        global $pipe;
        
        $relationTable = $params->column->getRelationData('column_table_relation_id');
        $table = $relationTable->getRelationData('relation_table_id');
        
        $temp = new BaseModel($table->name);
        $model = $temp->getQuery();
        
        $temp->addJoinsWithColumns($model, [$params->column], TRUE);


        $alias = $this->getFirstJoinTableAliasForSelectColumn($relationTable);
        
        $source = $relationTable->relation_source_column;
        if(!strstr($source, '.')) $source = $table->name.'.'.$source;      
        
        $display = $relationTable->relation_display_column;
        if(!strstr($display, '.')) $display = $table->name.'.'.$display; 
        
        $source = str_replace($alias.'.', $table->name.'.', $source);
        $source = helper('reverse_clear_string_for_db', $source);  

        $display = str_replace($alias.'.', $table->name.'.', $display);
        $display = helper('reverse_clear_string_for_db', $display); 

        
        $model->addSelect(DB::raw($source.' as source'));        
        $model->addSelect(DB::raw($display.' as display'));
        
        
        $model->where(function ($query) use($source, $display, $params)
        {
            if(strstr($params->search, 'source:'))
            {
                $searchStr = explode('source:', $params->search)[1];
                $query->whereRaw($source.'::text ilike \'%'.$searchStr.'%\'');
            }
            else if(strstr($params->search, 'display:'))
            {
                $searchStr = explode('display:', $params->search)[1];
                $query->orWhereRaw($display.'::text ilike \'%'.$searchStr.'%\'');
            }
            else
            {
                $query->whereRaw($source.'::text ilike \'%'.$params->search.'%\'');
                $query->orWhereRaw($display.'::text ilike \'%'.$params->search.'%\'');
            }
        });        

        
        if(\Request::segment(7) == 'getRelationTableData') 
        {
            $tree = \Request::segment(8);
            $columnArrayId = explode(':', $tree)[1];
            $columnArray = get_attr_from_cache('column_arrays', 'id', $columnArrayId, '*');
            $ids = json_decode($columnArray->join_table_ids);
            $joinTable = get_attr_from_cache('join_tables', 'id', $ids[0], '*');
            $pipe['table'] = get_attr_from_cache('tables', 'id', $joinTable->join_table_id, 'name');//pipe filter içinde kullanılıyor
        }
        
        $temp->addFilters($model, $table->name, 'selectColumnData');
        
        $sourceSpace = $this->getSourceSpaceFromUpColumn($params);
        if($sourceSpace != FALSE)
            $model->whereIn($source, $sourceSpace);
        
        if(in_array($table->name, $this->deletables) && $pipe['SHOW_DELETED_TABLES_AND_COLUMNS'] != '1')
            $model->where($table->name.'.name', 'not like', 'deleted\_%');
        
        $offset = ($params->page - 1) * $params->record_per_page;
        $params->count = $model->count();
        
        $params->records = $model->limit($params->record_per_page)->offset($offset)->get();
        
        $params->relation_source_column_name = 'source';
        $params->relation_display_column_name = 'display';
        
        return $this->getSelectColumnDataFromRecords($params);
    }
    
    public function getSelectColumnDataForRelationSql ($params)
    {
        $sql = ' from ('.$params->relation->relation_sql.') as main_table where ';
        
        if(strstr($params->search, 'source:'))
        {
            $searchStr = explode('source:', $params->search)[1];
            $sql .= $params->relation->relation_source_column.'::text ilike \'%'.$searchStr.'%\' ';
        }
        else if(strstr($params->search, 'display:'))
        {
            $searchStr = explode('display:', $params->search)[1];
            $sql .= $params->relation->relation_display_column.'::text ilike \'%'.$searchStr.'%\' ';
        }
        else
        {
            $sql .= ' ('. $params->relation->relation_display_column.'::text ilike \'%'.$params->search.'%\' ';
            $sql .= ' or '.$params->relation->relation_source_column.'::text ilike \'%'.$params->search.'%\' )';
        }
            
        global $pipe;
        if(($pipe['table'] == 'tables' || $pipe['table'] == 'columns') && $pipe['SHOW_DELETED_TABLES_AND_COLUMNS'] != '1')
            $sql .= ' and name::text not like \'deleted\_%\' )';
        
        $sourceSpace = $this->getSourceSpaceFromUpColumn($params);
        if($sourceSpace != FALSE)
        {
            dd('up column kontrol getSelectColumnDataForRelationSql');
            //$model->whereIn($sourceColumn->name, $sourceSpace);
        }
        
        
        $params->count = DB::select('select count(*) '.$sql)[0]->count;
        
        $sql .= 'order by ' . $params->relation->relation_source_column . ' limit '.$params->record_per_page.' offset '.(($params->page - 1) * $params->record_per_page );
        $params->records = DB::select('select * '.$sql);
        
        $params->relation_source_column_name = $params->relation->relation_source_column;
        $params->relation_display_column_name = $params->relation->relation_display_column;
        
        return $this->getSelectColumnDataFromRecords($params);
    }*/
    
    public function getGroupByDataForTableIdAndColumnIds($params)
    {
        
        dd(121, $params);
        
        global $pipe;
        
        $relationTable = $this->getRelationData('column_table_relation_id');
        
        $table = $relationTable->getRelationData('relation_table_id');
        $sourceColumn = $relationTable->getRelationData('relation_source_column_id');
        $displayColumn = $relationTable->getRelationData('relation_display_column_id');
        
        $records = DB::table($pipe['table'])->select($this->name)->distinct()->get();
        foreach($records as $i => $rec) 
            $records[$i]->temp_display_column = get_attr_from_cache($table->name, 
                                                                        $sourceColumn->name, 
                                                                        $rec->{$this->name}, 
                                                                        $displayColumn->name);
        
        $temp = helper('get_null_object');
        $temp->records = $records;
        $temp->source_column_name = $this->name;
        $temp->display_column_name = 'temp_display_column';
        
        return $this->getGroupByDataFromRecords($temp);
    }

    /*public function getSelectColumnDataForTableIdAndColumnNames($params)
    {
        global $pipe;
        
        $relationTable = $params->column->getRelationData('column_table_relation_id');
        
        $table = $relationTable->getRelationData('relation_table_id');
        
        $sourceColumn = $relationTable->relation_source_column;
        $sourceColumn = helper('reverse_clear_string_for_db', $sourceColumn);
        
        $displayColumn = $relationTable->relation_display_column;
        $displayColumn = helper('reverse_clear_string_for_db', $displayColumn);
        
        $offset = ($params->page - 1) * $params->record_per_page;
        $model = DB::table($table->name)
                ->selectRaw('*, '.$sourceColumn.', '.$displayColumn.' as tempdisplay');
        
        $model->where(function ($query) use($params, $displayColumn, $sourceColumn)
        {
            if(strstr($params->search, 'source:'))
            {
                $searchStr = explode('source:', $params->search)[1];
                $where = '(('.$sourceColumn.')::text ilike  \'%'.$searchStr.'%\')';
            }
            else if(strstr($params->search, 'display:'))
            {
                $searchStr = explode('display:', $params->search)[1];
                $where = '(('.$displayColumn.')::text ilike  \'%'.$searchStr.'%\')';
            }
            else
            {
                $where = '(('.$displayColumn.')::text ilike  \'%'.$params->search.'%\') or (('.$sourceColumn.')::text ilike  \'%'.$params->search.'%\')';
            }
            
            $query->whereRaw($where);
        });
        
        $sourceSpace = $this->getSourceSpaceFromUpColumn($params);
        if($sourceSpace != FALSE)
            $model->whereIn($sourceColumn, $sourceSpace);
        
        if(in_array($table->name, $this->deletables) && $pipe['SHOW_DELETED_TABLES_AND_COLUMNS'] != '1')
            $model->where($table->name.'.name', 'not like', 'deleted\_%');
        
        $temp = new BaseModel($table->name); 
		$temp->addFilters($model, $table->name, 'selectColumnData');
        
        $params->count = $model->count();
        $params->records = $model->limit($params->record_per_page)->offset($offset)->get();
        
        $params->relation_source_column_name = $sourceColumn;
        $params->relation_display_column_name = 'tempdisplay';
        
        return $this->getSelectColumnDataFromRecords($params);
    }
    
    public function getSelectColumnDataForDataSource($params)
    {
        $sourceSpace = $this->getSourceSpaceFromUpColumn($params);
        if($sourceSpace) dd('upColumn ı aramaya dahil et');
        
        $relation = $params->column->getRelationData('column_table_relation_id');
        $dataSource = $relation->getRelationData('column_data_source_id');
            
        $repository = NULL;
        eval(helper('clear_php_code', $dataSource->php_code));
        
        $data = $repository->searchRecords($params->search, $params->page, $params->record_per_page);
        
        $return['results'] = [];
        foreach($data['records'] as $source => $display)
        {
            $temp['id'] = $source;
            $temp['text'] = $display;
            array_push($return['results'], $temp);
        }
        
        $return['pagination']['more'] = $data['more'];
        
        return $return;
    }*/
    
    
    
    /****    Up Column Functions    ****/    
    
    /*private function getSourceSpaceFromUpColumn($params)
    {
        //dd($params);
        if(strlen($params->up_column_data) == 0) return FALSE;
        
        $params->upColumnRule = get_attr_from_cache('up_columns', 'id', $params->column->up_column_id, '*');
        $upColumnName = get_attr_from_cache('columns', 'id', $params->upColumnRule->column_id, 'name');
        if($upColumnName != $params->up_column_name)
            custom_abort ('invalid.up.column.'.$params->up_column_name);
        
        $data = $params->up_column_data;
        $request = (array)$params->request;
        $record = (array)$params->record;
        
        $return = NULL;
        eval(helper('clear_php_code', $params->upColumnRule->php_code)); 
        
        if($return == '***') return FALSE;
        
        return $return;
    }*/
    
    
    
    /****    Common Functions    ****/
    
    private function getGroupByDataFromRecords($params)
    {
        global $pipe;
        
        $return = 
        [
            'status' => 'success', 
            'code' => 200, 
            'data' => 
            [
                'tableDisplayName' => get_attr_from_cache('tables', 'name', $pipe['table'], 'display_name'),
                'columnDisplayName' => $this->display_name,
                'columnGuiTypeName' => get_attr_from_cache('column_gui_types', 'id', $this->column_gui_type_id, 'name'),
                'columnName' => $this->name,
                'records' => []
            ]
        ];
        foreach($params->records as $rec)
        {
            $temp['source'] = $rec->{$params->source_column_name};
            $temp['display'] = $rec->{$params->display_column_name};
            array_push($return['data']['records'], $temp);
        }
        
        return $return;
    }
    
    /*private function getUpColumnControl($params)
    {
        if(strlen($this->up_column_id) == 0) return FALSE;
        if(strlen($params->upColumnName) == 0) return FALSE;
        if(strlen($params->upColumnData) > 0) return FALSE;
        
        $tableId = get_attr_from_cache('tables', 'name', $params->table->getTable(), 'id');
        
        $relation = $this->getRelationData('up_column_id');
        $relation->fillVariables();
        
        if(!@in_array($tableId, $relation->table_ids)) return FALSE;
              
        $columnDisplayName = get_attr_from_cache('columns', 'name', $params->upColumnName, 'display_name');
        
        return
        [
            'results' =>
            [
                [
                    'id' => -9999,
                    'text' => 'Önce ' . $columnDisplayName . ' seçiniz'
                ]
            ],
            'pagination' => 
            [
                'more'=> FALSE
            ]
        ];
    }*/
}