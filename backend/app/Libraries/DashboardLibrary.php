<?php

namespace App\Libraries;

use Storage;
use Cache;
use DB;

class DashboardLibrary
{
    use DashboardLibraryTrait;
    
    public function RecordCount($param1, $param2)
    {
        $sumAllTablesCounts = Cache::remember('sumAllTablesCounts', 60 * 60 * 24, function()
        {
            $except = ['migrations', 'password_resets', 'sessions', 'jobs', 'failed_jobs'];

            $sum = 0;
            
            $tableNames = DB::connection()->getDoctrineSchemaManager()->listTableNames();
            foreach($tableNames as $tableName)
                if(!in_array($tableName, $except))
                    if(!strstr($tableName, '_archive'))
                        $sum += DB::table(trim($tableName, '"'))->count();
                
            return $sum;
        });
        
        $count = DB::table($param1)->count();
        
        return 
        [
            'table_display_name' => get_attr_from_cache('tables', 'name', $param1, 'display_name'),
            'count' => $count,
            'all' => $sumAllTablesCounts
        ];
    }
    
    public function RefreshableNumber($param1, $param2)
    {
        return $this->{'RefreshableNumber'.$param1}($param2);
    }
    
    public function ComboBoxList($param1, $param2)
    {
        if($param1 == 'Test' && $param2 == '0') return $this->ComboBoxListTestData();
        return $this->{'getComboBoxList'.$param1.$param2.'Data'}();
        
    }
    
    public function DataEntegratorStatus($param1, $param2)
    {
        $relation = get_model_from_cache('data_source_tbl_relations', 'id', $param1);
        
        try
        {
            $message = Storage::disk('public')->get('dataEntegratorStatus/'.$param1.'.status');
            
            global $pipe;
            $pipe['table'] = 'data_source_tbl_relations';
            
            return 
            [
                'message' => $message,
                'source' => $relation->getRelationData('data_source_rmt_table_id')->display,
                'table' => $relation->getRelationData('table_id')->display_name,
                'direction' => $relation->getRelationData('data_source_direction_id')->name
            ];
        } 
        catch (\Exception $ex) 
        {
            return
            [
                'message' => 'no.data',
                'source' => @$relation->getRelationData('data_source_rmt_table_id')->display,
                'table' => @$relation->getRelationData('table_id')->display_name,
                'direction' => @$relation->getRelationData('data_source_direction_id')->name
            ];
        }
    }
    
    public function GraphicXY($param1, $param2)
    {
        if($param1 == 'Test' && $param2 == '0') return $this->GraphicXYTestData();
        return $this->{'getGraphicXY'.$param1.$param2.'Data'}();
    }
      
    public function GraphicPie($param1, $param2)
    {
        if($param1 == 'Test' && $param2 == '0') return $this->GraphicPieTestData();
        return $this->{'getGraphicPie'.$param1.$param2.'Data'}();
    }    
}