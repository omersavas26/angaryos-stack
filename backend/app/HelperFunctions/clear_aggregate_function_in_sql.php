<?php

$search = ["'***'",'***','1)', "',',", "','", '),', ',', 'string_agg(', 'split_part('];

$params = str_replace($search, '', $params);
$params = explode(' as ', $params)[0];
$params = trim($params);

return $params;