<?php

$cache_name = 'tableName:'.$params.'|allColumsFromDb';

$columns = Cache::rememberForever($cache_name, function() use($params)
{   
    $sql = 'SELECT column_name as name, data_type as type, udt_name FROM information_schema.columns';
    $sql .= ' WHERE table_schema = \''.env('DB_SCHEMA', 'public').'\' AND ';
    $sql .= ' table_name   = \''.$params.'\'';

    $table_columns = \DB::select($sql);
    $columns = [];
    foreach($table_columns as $column)
    {
        $srid = NULL;

        if($column->type == 'USER-DEFINED')
        {
            $sql = "SELECT type FROM geometry_columns WHERE f_table_schema = 'public' AND f_table_name = '";
            $sql .=  $params."' and f_geometry_column = '$column->name'";

            $type = DB::select($sql);

            $column->type = strtolower($type[0]->type);
            $srid = DB::select('SELECT Find_SRID(\'public\', \''.$params.'\', \''.$column->name.'\');');
            $srid = $srid[0]->find_srid;
        }

        $columns[$column->name] =
        [
            'id' => get_attr_from_cache('columns', 'name', $column->name, 'id'),
            'name' => $column->name,
            'type' => $column->type,
            'srid' => $srid,
            'default' =>get_attr_from_cache('columns', 'name', $column->name, 'default')
        ];
    }

    return $columns;
});

return $columns;