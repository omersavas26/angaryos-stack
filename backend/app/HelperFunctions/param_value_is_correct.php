<?php
global $pipe;

if(is_string($validation))
    $validation = [$validation];

if($validation == []) return true;

$params = (array)$params;
$columnNames = array_keys($params);
if(in_array('required', $validation) && !in_array($name, $columnNames)) 
    abort(helper('response_error', 'column.is.required: '.$name));

if(in_array('*auto*', $validation)) 
{
    $column = get_attr_from_cache('columns', 'name', $name, '*');
    if($column == NULL) 
    {
        $arr = ['required'];
    }
    else
    {
        $columnValidationIds = json_decode($column->column_validation_ids);

        $arr = [];
        if($columnValidationIds != NULL)
            foreach($columnValidationIds as $vId)
            {
                $v = get_attr_from_cache('column_validations', 'id', $vId, '*');

                $temp = explode(':', $v->validation_with_params)[0];
                $phpCode = get_attr_from_cache('validations', 'name', $temp, 'php_code');
                if($phpCode != null)
                {
                    Illuminate\Support\Facades\Validator::extend($temp, function($attribute, $value, $parameters) use($phpCode)
                    {
                        $return = FALSE;
                        eval(helper('clear_php_code', $phpCode));            
                        return $return;
                    });
                }

                if($v->validation_with_params == 'unique')
                {
                    $v->validation_with_params = 'unique:'.$pipe['table'];

                    if(\Request::segment(5) == $pipe['table'] && \Request::segment(6) == NULL)
                        $v->validation_with_params = '';
                    if(\Request::segment(7) == 'update')
                    {
                        $old = get_attr_from_cache($pipe['table'], 'id', $this->segment(6), $column->name);
                        $new = read_from_response_data($column->name);

                        if($old == $new)
                            $v->validation_with_params = '';
                    }
                }

                array_push ($arr, $v->validation_with_params);
            }
    }
    
    $key = array_search('*auto*', $validation);
    $validation[$key] = implode('|', $arr);
}

$arr = $params[$name];
if(!is_array($arr)) $arr = [$arr];

foreach($arr as $data)
{
    $validator = Validator::make([$name => $data], [$name => implode('|', $validation) ]);
    if(!@$validator->fails()) return true;

    $errors = $validator->errors()->getMessages();

    abort(helper('response_error', 'column.'.$name.'.validation.error: '.implode(', ', $errors[$name])));
}