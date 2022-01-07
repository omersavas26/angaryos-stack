<?php

namespace App\Listeners;

use DB;

class TableBeforeTriggerSubscriber 
{
    private function triggerSubscriber($table, $column, $subscriber, $type, $record)
    {
        if($column != NULL) $value = read_from_response_data($column->name);
        
        $requests = \Request::all();
        $user = \Auth::user();
        
        $return = NULL;
        eval(helper('clear_php_code', $subscriber->php_code));  
        
        return $return == NULL ? [] : $return;
    }
    
    private function getSubscribers($ids)
    {
        if(!is_array($ids)) $ids = json_decode ($ids);
        
        $subscribers = [];
        foreach($ids as $id)
            array_push ($subscribers, get_attr_from_cache ('subscribers', 'id', $id, '*'));
        
        return $subscribers;
    }

    private function controlSubscribers($table, $columns, $type, $record = NULL)
    {
        global $pipe;
        if(isset($pipe['subscriberTypeOverride'])) $type = $pipe['subscriberTypeOverride'];
        
        $returned = [];
        if(strlen($table->subscriber_ids) > 0)
        {
            $subscribers = $this->getSubscribers($table->subscriber_ids);
            foreach($subscribers as $subscriber)
            {
                $subscriberTypeName = get_attr_from_cache('subscriber_types', 'id', $subscriber->subscriber_type_id, 'name');
                
                if($subscriberTypeName != 'before') continue;
                
                $temp = $this->triggerSubscriber($table, NULL, $subscriber, $type, $record);
                $returned = array_merge($returned, $temp);
            }
        }
        
        foreach($columns as $column)
            if(isset($column->subscriber_ids))
                if(is_array($column->subscriber_ids) || strlen($column->subscriber_ids) > 0)
                {
                    $subscribers = $this->getSubscribers($column->subscriber_ids);
                    foreach($subscribers as $subscriber)
                    {
                        $subscriberTypeName = get_attr_from_cache('subscriber_types', 'id', $subscriber->subscriber_type_id, 'name');
                        if($subscriberTypeName != 'before') continue;

                        $temp = $this->triggerSubscriber($table, $column, $subscriber, $type, $record);
                        $returned = array_merge($returned, $temp);
                    }
                }
        
        if(count($returned) > 0)
        {
            global $pipe;
            $pipe['overrideRequestDatas'] = $returned;
        }
        
        return TRUE;
    }
    
    public function storeRequested($params)
    {
        return $this->controlSubscribers($params->table, $params->columns, 'create');
    }
    
    public function updateRequested($params, $record)
    {
        return $this->controlSubscribers($params->table, $params->columns, 'update', $record);
    }
    
    public function deleteRequested($record)
    {
        $tableName = $record->getTable();
        $table = get_attr_from_cache('tables', 'name', $tableName, '*');
        
        $columns = [];
        foreach($record->toArray() as $columnName => $value)
        {
            $column = get_attr_from_cache('columns', 'name', $columnName, '*');
            array_push($columns, $column);
        }
        
        return $this->controlSubscribers($table, $columns, 'delete', $record);
    }
    
    public function cloneRequested($dataArray)
    {
        global $pipe;
        $tableName = $pipe['table'];
        $table = get_attr_from_cache('tables', 'name', $tableName, '*');
        
        $columns = [];
        foreach($dataArray as $columnName => $data)
        {
            $column = get_attr_from_cache('columns', 'name', $columnName, '*');
            array_push($columns, $column);
        }
        
        return $this->controlSubscribers($table, $columns, 'clone', $dataArray);
    }
    
    public function restoreRequested($archiveRecord)
    {
        $tableName = $archiveRecord->getTable();
        
        if(strstr($tableName, '_archive'))
            $tableName = str_replace('_archive', '', $tableName);
        
        $table = get_attr_from_cache('tables', 'name', $tableName, '*');
        
        $columns = [];
        foreach($archiveRecord->toArray() as $columnName => $value)
        {
            $column = get_attr_from_cache('columns', 'name', $columnName, '*');
            array_push($columns, $column);
        }
        
        return $this->controlSubscribers($table, $columns, 'restore', $archiveRecord);
    }
}
