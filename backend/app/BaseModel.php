<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

use \App\BaseModelTraits\BaseModelSqlInjectionTrait;
use \App\BaseModelTraits\BaseModelGetRelationDataTrait;
use \App\BaseModelTraits\BaseModelGetDataTrait;
use \App\BaseModelTraits\BaseModelSelectColumnDataTrait;
use \App\BaseModelTraits\BaseModelGroupByDataTrait;

use \App\Libraries\BaseQueryBuilder;

use \Cache;
use \DB;

class BaseModel extends Model
{   
    use BaseModelSqlInjectionTrait;
    use BaseModelGetRelationDataTrait;
    use BaseModelGetDataTrait;
    use BaseModelSelectColumnDataTrait;
    use BaseModelGroupByDataTrait;
    
    
    
    protected $dates = ['created_at', 'updated_at'];
    protected $fillable = [], $casts = [];
    protected $allColumnsFromDB = [];
    
    
    
    public function __construct($table = NULL, array $attributes = []) 
    {
        if($table) $this->setTable($table);
        
        $this->fillVariables();
        
        parent::__construct($attributes); 
    }
    
    public function fillVariables()
    {
        if(count($this->fillable) > 0) return;
        
        $this->fillAllColumnsFromDB();
        $this->fillFillableColumns();
        $this->fillCastsColumns();        
    }
    
    public function getAllColumnsFromDB()
    {
        if($this->allColumnsFromDB == [])
            $this->fillAllColumnsFromDB();
        
        return $this->allColumnsFromDB;
    }
    
    
    
    /****    Override    ****/
    
    public function newBaseQueryBuilder()
    {
        $connection = $this->getConnection();

        return new BaseQueryBuilder(
            $connection, $connection->getQueryGrammar(), $connection->getPostProcessor(), $this
        );
    }
    
    public function find($id, $columns = ['*'])
    {
        $return = parent::find($id, $columns);
        if($return == NULL) return NULL;
        
        $return->fillVariables();
        
        return $return;
    }
    
    private function IsWkt($str)
    {
        $str = strtolower($str);
        if(substr($str, 0, 5) == 'point') return TRUE;
        if(substr($str, 0, 10) == 'linestring') return TRUE;
        if(substr($str, 0, 7) == 'polygon') return TRUE;
        
        if(substr($str, 0, 10) == 'multipoint') return TRUE;
        if(substr($str, 0, 15) == 'multilinestring') return TRUE;
        if(substr($str, 0, 12) == 'multipolygon') return TRUE; 

        return FALSE;
    }

    public function save(array $options = [])
    {
        $this->fillVariables();

        
        
        $orj = [];
        foreach($this->getAllColumnsFromDB() as $columnName => $column)
            if(strlen($column['srid']) > 0)
                if(strlen($this->{$column['name']}) > 0)
                    if(!is_object($this->{$column['name']}))
                        if($this->IsWkt($this->{$column['name']}))
                        {
                            $orj[$column['name']] = $this->{$column['name']};
                            $this->{$column['name']} = DB::raw('ST_GeomFromText(\''.$this->{$column['name']}.'\', '.$column['srid'].')');
                        }
                
         
        foreach(array_keys($this->toArray()) as $columnName)
            if(substr($columnName, -15) == '__relation_data')
                unset($this->{$columnName});
        
        $return = parent::save($options);        
        
        foreach($orj as $columnName => $value) 
        {
            $this->{$columnName} = $value;
            $this->original[$columnName] = $value;
        }
        
        return $return;
    }
    
    public function fillAllColumnsFromDB()
    {
        $this->allColumnsFromDB = helper('get_all_columns_from_db', $this->getTable());
    }
    
    public function fillFillableColumns()
    {
        if($this->allColumnsFromDB == []) return;
        $this->fillable = $this->getFillableColumns();
    }
    
    public function fillCastsColumns()
    {
        if($this->allColumnsFromDB == []) return;
        $this->casts = $this->getCastsColumns();
    }
    
    public function getFillableColumns()
    {
        $cacheName = 'tableName:'.$this->getTable().'|fillableColumns';
        
        $fillable = Cache::rememberForever($cacheName, function()
        {      
            $temp = [];
            
            foreach($this->allColumnsFromDB as $column)
                array_push($temp, $column['name']);
            
            return $temp;
        });
        
        return $fillable;
    }
    
    public function getCastsColumns()
    {
        $cache_name = 'tableName:'.$this->getTable().'|castsColumns';
        
        $casts = Cache::rememberForever($cache_name, function()
        {      
            $temp = [];
            
            foreach($this->allColumnsFromDB as $column)
                if(strstr($column['type'], 'json'))
                    $temp[$column['name']] = 'array';
            
            return $temp;
        });
        
        return $casts;
    }
    
     public function getRelationData($columnName)
    {
        if(isset($this->{$columnName . '__relation_data'}))
                return $this->{$columnName . '__relation_data'};
                
        $json = $this->{$columnName};
            if(is_array($this->{$columnName}))
                $json = json_encode($this->{$columnName});
          
        $cacheName = 'tableName:'.$this->getTable().'|columnName:'.$columnName.'|columnData:'.$json.'|relationData';
        $th = $this;
        
        return Cache::rememberForever($cacheName, function() use($th, $columnName)
        {      
            $relationId = get_attr_from_cache('columns', 'name', $columnName, 'column_table_relation_id');
            if(strlen($relationId) == 0)
            {
                $this->{$columnName . '__relation_data'} = $this->{$columnName};
            }
            else
            {
                $column = get_attr_from_cache('columns', 'name', $columnName, '*');
                $th->fillRelationData($column);
            }
            
            return $this->{$columnName . '__relation_data'};
        });
    }
}