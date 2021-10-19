<?php

namespace App\Listeners;

use DB;

class TableSubscriber 
{
    use TableSubscriberTrait;
    
    public function listRequested($model, $params) 
    {
        return $this->getDataForList($model, $params);
    }
    
    public function createRequested($model, $params) 
    {
        return $this->getDataForCreate($model, $params);
    }
    
    public function editRequested($model, $params) 
    {
        return $this->getDataForEdit($model, $params);
    }
    
    public function showRequested($model, $params) 
    {
        return $this->getDataForShow($model, $params);
    }
    
    public function exportRequested($model) 
    {
        return $this->getDataForExport($model);
    }
    
    public function getTableGroupByDataRequested($column, $params)
    {
        return $column->getGroupByData($params);
    }
    
    public function selectColumnDataRequested($column, $params) 
    {
        return $column->getSelectColumnData($params);
    }
    
    public function realtionTableDataRequested($record, $params)
    {
        return $record->getRelationTableDataForInfo($params);
    }
    
    public function storeRequested($params)
    {
        return $this->createNewRecord($params->request, $params->table->name);
    }
    
    public function updateRequested($params, $record)
    {
        return $this->updateRecord($record, $params->request);
    }
    
    public function deleteRequested($record)
    {
        return $this->deleteRecord($record);
    }
    
    public function getCloneDataForUniqueColumn($dbTypeName, $dataArray, $columnName, $repeat = 1)
    {
        global $pipe;
        
        $temp = $dataArray[$columnName];
        
        switch($dbTypeName)
        {
            case 'string':
            case 'text':
                for($i = 0; $i <$repeat; $i++) $temp .= 'klon';
                break;
            case 'integer':
                for($i = 0; $i <$repeat; $i++) $temp += 1000;
                break;
            default:
                custom_abort('db.type.'.$dbTypeName.'.not.clonable');
        }
        
        $recs = \DB::table($pipe['table'])->where($columnName, $temp)->get();
        if(count($recs) == 0) return $temp;
        
        return $this->getCloneDataForUniqueColumn($dbTypeName, $dataArray, $columnName, $repeat+1);
    }
    
    public function cloneRequested($dataArray)
    {
        foreach($dataArray as $key => $value)
            if(is_array($value))
                $dataArray[$key] = json_encode($value);
           
        foreach(array_keys($dataArray) as $columnName)
        {
            $vals = get_attr_from_cache('columns', 'name', $columnName, 'column_validation_ids');
            if(strlen($vals) == 0) continue;
            
            $vals = json_decode($vals);
            foreach($vals as $val)
            {
                $temp = get_attr_from_cache('column_validations', 'id', $val, 'validation_with_params');
                $temp = explode(':', $temp)[0];
                
                if($temp == 'unique')
                {
                    $dbTypeId = get_attr_from_cache('columns', 'name', $columnName, 'column_db_type_id');
                    $dbTypeName = get_attr_from_cache('column_db_types', 'id', $dbTypeId, 'name');
                    $dataArray[$columnName] = $this->getCloneDataForUniqueColumn($dbTypeName, $dataArray, $columnName);
                }
            }
        }
        
        $errors = $this->validateRecordData($dataArray);
        if($errors != []) return $errors;
        
        unset($dataArray['remote_record_ids']);
        unset($dataArray['disable_data_entegrates']);
        
        return $this->createNewRecord($dataArray);
    }
    
    public function archiveRequested($record, $params)
    {
        return $this->getDataForArchive($record, $params);
    }
    
    public function deletedRequested($params)
    {
        return $this->getDataForDeleted($params);
    }
    
    public function restoreRequested($archiveRecord)
    {
        $tableName = substr($archiveRecord->getTable(), 0, -8);
        $record = get_attr_from_cache($tableName, 'id', $archiveRecord->record_id, '*');
        
        return $this->restoreRecord($archiveRecord, $record);
    }
    
    public function storeSuccess($params, $record)
    {
        return $this->getDataForSelectElement($params, $record);
    }
    
    public function updateSuccess($params, $orj, $record)
    {
        return $this->getDataForSelectElement($params, $record);
    }
    
    public function authAssignRequested($params)
    {
        DB::beginTransaction();
        
        $this->authAssign($params);
        
        DB::commit();
    }
    
    public function quickSearch($model, $params, $words)
    {
        return $this->getDataForQuickSearch($model, $params, $words);
    }
    
    public function relationDataInfoRequested($record, $column)
    {
        $source = read_from_response_data('source');
        $relationRecord = $record->getRelationData($column->name);
        
        $array = is_array($relationRecord);
        
        if(!$array) $relationRecord = [$relationRecord];
        $return = [];
        
        $auths = @\Auth::user()->auths['tables'];
        if($auths == NULL) $auths = [];
        
        foreach($relationRecord as $temp)
        {
            if(strlen($source) > 0) 
                if($temp->_source_column != $source) 
                    continue;
              
            if(strlen($temp->tableName) > 0)
                if(!isset($auths[$temp->tableName]['shows']))
                    custom_abort('no.auth.for.'.$temp->tableName.'.shows');
                
            $temp = 
            [
                'tableName' => $temp->tableName,
                'tableId' => get_attr_from_cache('tables', 'name', $temp->tableName, 'id'),
                'recordId' => $temp->recordId
            ];
            
            array_push($return, $temp);
        }
      
        if(strlen($source) > 0) $array = FALSE;
        
        return $array ? $return : @$return[0]; 
    }
}
