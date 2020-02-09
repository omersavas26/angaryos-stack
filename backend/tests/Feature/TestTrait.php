<?php

namespace Tests\Feature;

use App\User;

use DB;

trait TestTrait
{
    /****    Get Data Functions    ****/
    
    private function getLastId($tableName)
    {
        return DB::table($tableName)->max('id');
    }
    
    private function getToken()
    {
        $user = User::find(1);
        return helper('create_user_token', $user);
    }
    
    private function getBaseUrl()
    {
        return '/api/v1/';
    }
    
    private function getBaseUrlWithToken()
    {
        $base = $this->getBaseUrl();
        $token = $this->getToken();
        return $base.$token.'/';
    }
    
    private function getDataFromResponseOrData($responseOrData)
    {
        if(get_class($responseOrData) == 'Illuminate\Foundation\Testing\TestResponse')
           $responseOrData = $responseOrData->getData()->data;
        
        return $responseOrData;
    }


    
    /****    Common Control Data Functions    ****/
    
    private function standartTest($url, $control = TRUE)
    {
        $url = $this->getBaseUrlWithToken() . $url;
        $response = $this->get($url);
        
        if($control)
            $this->controlResponseIsSuccess($response);
        
        return $response;
    }
    
    private function controlResponseIsSuccess($response)
    {
        $response->assertStatus(200);
        
        $this->assertEquals(get_class($response), 'Illuminate\Foundation\Testing\TestResponse');
        $this->assertEquals($response->getData()->code, 200);
        $this->assertEquals($response->getData()->status, 'success');
    }
    
    private function controlResponseIsError($response)
    {
        $response->assertStatus(400);
        
        $this->assertEquals(get_class($response), 'Illuminate\Foundation\Testing\TestResponse');
        $this->assertEquals($response->getData()->code, 400);
        $this->assertEquals($response->getData()->status, 'error');
    }
    
    private function controlResponseIsServiceOk($response)
    {
        $this->controlResponseIsSuccess($response);
        $this->assertEquals($response->getData()->data->message, 'service.ok');
    }
    
    private function controlResponseIsFailToken($response)
    {
        $this->controlResponseIsError($response);
        $this->assertEquals($response->getData()->data->message, 'fail.token');
    }
    
    private function controlResponseOrDataHasAttributes($response, $attributes)
    {
        $data = $this->getDataFromResponseOrData($response);
        if(!is_array($attributes)) $attributes = [$attributes];
        
        $keys = array_keys(get_object_vars($data));
        foreach($attributes as $attribute)
            $this->assertTrue(in_array($attribute, $keys));
    }
    
    private function controlResponseHasNumericAttributes($response, $attributes)
    {
        if(!is_array($attributes)) $attributes = [$attributes];
        
        $data = $this->getDataFromResponseOrData($response);
        $this->controlResponseOrDataHasAttributes($data, $attributes);
        
        foreach($attributes as $attribute)
            $this->assertTrue(is_numeric($data->{$attribute}));
    }
    
    private function controlResponseHasBooleanAttributes($response, $attributes)
    {
        if(!is_array($attributes)) $attributes = [$attributes];
        
        $data = $this->getDataFromResponseOrData($response);
        $this->controlResponseOrDataHasAttributes($data, $attributes);
        
        foreach($attributes as $attribute)
            $this->assertTrue(is_bool($data->{$attribute}));
    }
    
    private function createColumnAndTest($url)
    {
        $response = $this->standartTest($url, FALSE); 
        $data = $response->getData();
        $this->assertEquals($data->data->message, 'success');
    }
}
