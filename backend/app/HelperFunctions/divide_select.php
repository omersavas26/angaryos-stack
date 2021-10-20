<?php

$arr = [];
$control = 0; $i = 0;
for($j = 0; $j < strlen($params); $j++)
{
    $s = $params[$j];

    if($s == '(') $control++;
    if($s == ')') $control--;

    if($control == 0 && $s == ',') 
    {
        $i++;
        continue;
    }   

    if(!isset($arr[$i])) $arr[$i] = '';

    if($control > 0) 
        $s = str_replace (['.', ','], ['|---|', '|___|'], $s);

    $arr[$i] .= $s;
}

foreach($arr as $i => $val)
    $arr[$i] = helper('clear_column_name_from_divided_operation_chars', $val);

return $arr;