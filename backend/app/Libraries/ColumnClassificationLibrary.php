<?php

namespace App\Libraries;

class ColumnClassificationLibrary 
{    
    /****    Routing Functions    ****/
    
    public static function relation($controller, $prefix, $column, $relation, $params)
    {
        global $pipe;
        
        $functions = ['BasicColumn', 'JoinedColumn', 'TableIdAndColumnIds', 'RelationSql', 'JoinTableIds', 'DataSource', 'TableIdAndColumnNames'];
        
        if(strlen($column->column_table_relation_id) > 0)
        {
            if($relation == NULL) $relation = self::getRelationFromColumn($column);
            if(!isset($params->relation)) @$params->relation = $relation;
            
            if(strlen($relation->relation_table_id) > 0)
            {
                if(strlen($relation->relation_source_column_id) > 0) $id = 2;
                else if(strlen($relation->join_table_ids) > 0) $id = 4;
                else $id = 6;//abort(helper('response_error', 'not.be.null.relation_source_column_id.and.join_table_ids'));
            }
            else if(strlen($relation->relation_sql) > 0) $id = 3;
            else if(strlen($relation->column_data_source_id) > 0) $id = 5;
            else abort(helper('response_error', 'not.be.null.relation_table_id.and.relation_sql'));
            
            $params->data_array = self::getDataArray($controller, $column);
        }
        else
        {
            if(strlen(@$column->select_raw) == 0) $id = 0;
            else $id = 1;
        }
        
        $functionName = $prefix.'For'.$functions[$id];
        if(isset($pipe['ColumnClassificationLibraryDebug'])) dd('ColumnClassificationLibrary::relation', $functionName);
        
        return $controller->{$functionName}($params);
    }
    
    public static function relationDbTypes($controller, $prefix, $sourceColumn, $targetColumn, $params)
    {
        global $pipe;
        
        $functions = ['OneToOne', 'OneToMany', 'ManyToOne'];
        
        $jsonType = get_attr_from_cache('column_db_types', 'name', 'jsonb', 'id');
        $intType = get_attr_from_cache('column_db_types', 'name', 'integer', 'id');
        
        if($targetColumn == NULL) $targetColumn = self::getTargetColumnFromColumn($sourceColumn);
          
        if($targetColumn->column_db_type_id == $sourceColumn->column_db_type_id)
            $id = 0;
        else if($targetColumn->column_db_type_id == $intType && $sourceColumn->column_db_type_id == $jsonType)            
            $id = 1;
        else if($targetColumn->column_db_type_id == $jsonType && $sourceColumn->column_db_type_id == $intType)            
            $id = 2;
        else 
            abort(helper('response_error', 'relation_db_types.different.types'));
        
        $functionName = $prefix.'For'.$functions[$id];
        if(isset($pipe['ColumnClassificationLibraryDebug'])) dd('ColumnClassificationLibrary::relationDbTypes', $functionName);
        
        return $controller->{$functionName}($params);
    }
    
    
    
    /****    Common Functions    ****/
    
    private static function getRelationFromColumn($column)
    {
        $relation = get_attr_from_cache('column_table_relations', 'id', $column->column_table_relation_id, '*');
        $relation->column_db_type_id = self::getTargetColumnDBTypeFromRelation($relation);
        
        return $relation;
    }
    
    private static function getTargetColumnFromColumn($column)
    {
        $relation = self::getRelationFromColumn($column);
        return self::getTargetColumnFromRelation($relation);      
    }
    
    private static function getTargetColumnFromRelation($relation)
    {
        if(strlen($relation->relation_source_column_id) > 0)
            $targetColumn = get_attr_from_cache('columns', 'id', $relation->relation_source_column_id, '*');
        else if(strlen($relation->relation_source_column) > 0)
        {
            $columnName = explode('.', $relation->relation_source_column);
            $columnName = last($columnName);
			$columnName = helper('reverse_clear_string_for_db', $columnName);
			if($columnName[0] == '"' && $columnName[strlen($columnName)-1] == '"') $columnName = substr($columnName, 1, -1);
            
            $targetColumn = get_attr_from_cache('columns', 'name', $columnName, '*');
        }
        else if($relation->column_data_source_id > 0)
            $targetColumn = null;
        else
            dd('kolon datası yanlış1');
                
        return $targetColumn;       
    }
    
    private static function getDataArray($record, $column)
    {
        if(@$record->{$column->name} == NULL) return [];
        
        $dataArray = $record->{$column->name};
        
        if(!is_array($dataArray))
            $dataArray = json_decode($dataArray);
        
        if(!is_array($dataArray)) 
            $dataArray = [$dataArray];
        
        return $dataArray;
    }
    
    private static function getTargetColumnDBTypeFromRelation($relation)
    {
        $targetColumn = self::getTargetColumnFromRelation($relation);
        return @$targetColumn->column_db_type_id;
    }
}