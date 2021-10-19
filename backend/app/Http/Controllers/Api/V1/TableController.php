<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;

use Phaza\LaravelPostgis\Geometries\Point;

use App\Libraries\ColumnClassificationLibrary;

use App\User;
use App\BaseModel;
use App\Http\Requests\BaseRequest;

use Event;
use Auth;
use Gate;
use DB;

class TableController extends Controller
{
    use TableTrait;
    
    public function __construct()
    {
        //\Cache::flush();
        
        $this->pipeOperations();        
        $this->fillAuthFunctions();  
    }
    
    
    
    /****    Default Functions    ****/
        
    public function index(User $user, BaseModel $model)
    {   
        send_log('info', 'Request List');
        
        $params = $this->getValidatedParamsForList();       
        if(Gate::denies('viewAny', $params)) $this->abort();
        
        $data = Event::dispatch('record.list.requested', [$model, $params])[0];
        
        send_log('info', 'Response List', $data);
        
        return helper('response_success', $data);
    }

    public function create(User $user, BaseModel $table)
    {
        send_log('info', 'Request Create');
        
        $params = $this->getValidatedParamsForCreate();
        
        if(Gate::denies('create', $params->column_set_id)) $this->abort();
        
        $record = new BaseModel($params->table);
        $data = Event::dispatch('record.create.requested', [$record, $params])[0];
                
        send_log('info', 'Response For Create', $data);
        
        return helper('response_success', $data);
    }

    public function store(User $user, BaseRequest $request)
    {
        send_log('info', 'Request Store', [$request->all()]);
        
        $params = $this->getValidatedParamsForStore($request);
        
        if(Gate::denies('create', $params->request->column_set_id)) $this->abort();
        
        $errors = $this->getValidationErrors($request->validator);
        if($errors != NULL) 
        {
            send_log('warning', 'Request Store Validation Error', [$errors->getData()]);
            return $errors;
        }
        
        DB::beginTransaction();
        
        $record = Event::dispatch('record.store.requested', $params)[1];
        $inFormData = Event::dispatch('record.store.success', [$params, $record])[2];
        
        DB::commit();
        
        send_log('info', 'Response Store', [$record, $inFormData]);
        
        $return = 
        [
            'message' => 'success',
            'id' => $record->id
        ];

        if($inFormData) $return['in_form_data'] = $this->UpdateInFormDataReverseClearStringForDB($inFormData);
        
        return helper('response_success', $return);
    }

    public function show(User $user, BaseModel $table, BaseModel $record)
    {
        send_log('info', 'Request Show', $record);
        
        $params = $this->getValidatedParamsForShow();
        
        if(Gate::denies('columnSetOrArrayIsPermitted', [$params->column_set_id, 'shows'])) $this->abort();
        
        $data = Event::dispatch('record.show.requested', [$record, $params])[0];
        
        if(Gate::denies('view', [$data['record']])) $this->abort();
        
        send_log('info', 'Response Show', $data);
        
        return helper('response_success', $data);
    }

    public function edit(User $user, BaseModel $table, BaseModel $record)
    {
        send_log('info', 'Request Edit');
        
        $params = $this->getValidatedParamsForEdit();
        
        if(Gate::denies('update', [$record, $params->column_set_id, @$params->single_column_name])) $this->abort();
        
        $data = Event::dispatch('record.edit.requested', [$record, $params])[0];
          
        send_log('info', 'Response For Edit', $data);
        
        return helper('response_success', $data);
    }

    public function update(BaseRequest $request, User $user, BaseModel $table, BaseModel $record)
    {        
        send_log('info', 'Request Update', [$request->all()]);
        
        $params = $this->getValidatedParamsForUpdate($request);
        
        if(Gate::denies('update', [$record, $params->request->column_set_id, @$params->request->single_column_name])) $this->abort();
        
        $errors = $this->getValidationErrors($request->validator);
        if($errors != NULL) 
        {
            send_log('warning', 'Request Update Validation Error', [$errors->getData()]);
            return $errors;
        }
        
        DB::beginTransaction();
        
        $orj = $record->toArray();
        $record = Event::dispatch('record.update.requested', [$params, $record])[1];
        $inFormData = Event::dispatch('record.update.success', [$params, $orj, $record])[2];
        
        DB::commit();
        
        send_log('info', 'Response Store', [$orj, $record, $inFormData]);
        
        $return = 'success';
        if($inFormData)
            $return = [
                'message' => $return,
                'in_form_data' => $this->UpdateInFormDataReverseClearStringForDB($inFormData)
            ];
            
        return helper('response_success', $return);
    }

    public function destroy(User $user, BaseModel $table, BaseModel $record)
    {
        send_log('info', 'Request Delete', $record);
        
        if(Gate::denies('delete', $record)) $this->abort();
        
        DB::beginTransaction();
        
        $data = Event::dispatch('record.delete.requested', $record)[0];        
        if($data)
        {
            Event::dispatch('record.delete.success', $record);
            DB::commit();
        }
        
        send_log('info', 'Response Detele', $data);
        
        return helper('response_success', 'success');
    }
    
    public function cloneRecord(User $user, BaseModel $table, BaseModel $record)
    {
        send_log('info', 'Request Clone', $record);
        
        if(Gate::denies('cloneRecord', $record)) $this->abort();
                
        DB::beginTransaction();
        
        $dataArray = $this->getRecordDataForClone($record);
        $cloneRecordOrErrors = Event::dispatch('record.clone.requested', [$dataArray])[1];
        
        if(is_array($cloneRecordOrErrors))
        {
            send_log('warning', 'Request Clone Validation Error', $cloneRecordOrErrors);
            
            $data['message'] = 'error';
            $data['errors'] = $cloneRecordOrErrors;
            return helper('response_success', $data);
        }
            
        Event::dispatch('record.clone.success', $cloneRecordOrErrors);
        
        DB::commit();
        
        send_log('info', 'Response clone', [$record, $cloneRecordOrErrors]);
        
        return helper('response_success', ['message' => 'success', 'id' => $cloneRecordOrErrors->id]);
    }
    
    public function export(User $user, BaseModel $table, BaseModel $record)
    {
        send_log('info', 'Request Export', $record);
        
        if(Gate::denies('export', $record)) $this->abort();
        
        $data = Event::dispatch('record.export.requested', $record)[0];
        
        send_log('info', 'Response export', [$record, $data]);
        return $data;
        return $this->exportAsFile($table, $record, $data);
    }
    
    public function archive(User $user, BaseModel $table, BaseModel $record)
    {   
        $params = $this->getValidatedParamsForArchive();
        
        send_log('info', 'Request Archive', $params);
        
        if(Gate::denies('archive', [$record, $params])) $this->abort();
        
        $data = Event::dispatch('record.archive.requested', [$record, $params])[0];
        
        send_log('info', 'Response Archive', $data);
        
        return helper('response_success', $data);
    }
    
    public function restore(User $user, BaseModel $table, BaseModel $archiveRecord)
    {   
        send_log('info', 'Request Restore', $archiveRecord);
        
        if(Gate::denies('restore', $archiveRecord)) $this->abort();
        
        DB::beginTransaction();
        
        $record = Event::dispatch('record.restore.requested', $archiveRecord)[1];
        if(Gate::denies('restored', $record)) $this->abort();
        
        Event::dispatch('record.restore.success', [$archiveRecord, $record]);
        
        DB::commit();
        
        send_log('info', 'Response Restore', $record);
        
        return helper('response_success', 'success');
    }
    
    public function deleted(User $user, BaseModel $table)
    {   
        $params = $this->getValidatedParamsForDeleted();
        
        send_log('info', 'Request Deleted', $params);
        
        if(Gate::denies('deleted', $params)) $this->abort();
        
        $data = Event::dispatch('record.deleted.requested', $params)[0];
        
        send_log('info', 'Response Deleted', $data);
        
        return helper('response_success', $data);
    }
    
    public function getRelationDataInfo(User $user, BaseModel $table, BaseModel $record, BaseModel $column)
    {
        send_log('info', 'Request Get Reletion Data Info');
        
        $data = Event::dispatch('record.relation.data.info.requested', [$record, $column])[0];
        
        send_log('info', 'Response Get Reletion Data Info', $data);
        
        return helper('response_success', $data);
    }
    
    
    
    /****    Additional Functions    ****/
    
    public function getTableGroupByData(User $user, BaseModel $table, BaseModel $column)
    {
        send_log('info', 'Request Table Group By Data', $column);
        
        $params = $this->getValidatedParamsForTableGroupByData($column->name);
                     
        $data = Event::dispatch('record.getTableGroupByData.requested', [$column, $params])[0];
        
        send_log('info', 'Response Table Group By Data', $data);
        
        return response()->json($data);
    }
    
    public function getSelectColumnData(User $user, BaseModel $table, BaseModel $column)
    {
        send_log('info', 'Request Select Column Data', $column);
        
        $params = $this->getValidatedParamsForSelectColumnData($table, $column);
        
        $data = Event::dispatch('record.selectColummnData.requested', [$column, $params])[0];
                
        send_log('info', 'Response Select Column Data', $data);
        
        return response()->json($data);
    }
    
    public function getSelectColumnDataInRelationTableData(User $user, BaseModel $table, BaseModel $record, $tree, BaseModel $column)
    {
        send_log('info', 'Request Select Column Data In Relation Table', [$record, $tree, $column]);
        
        if(Gate::denies('treeIsPermittedForRelationTableData', [$tree])) $this->abort();
        
        $params = $this->getValidatedParamsForSelectColumnDataInRelationTableData($tree, $column);
        
        $data = Event::dispatch('record.selectColummnData.requested', [$column, $params])[0];
        
        send_log('info', 'Request Select Column Data In Relation Table', $data);
        
        return response()->json($data);
    }
    
    public function getSelectColumnDataInArchive (User $user, BaseModel $table, BaseModel $record, BaseModel $column)
    {
        send_log('info', 'Request Select Column Data In Archive', $column);
        
        $params = $this->getValidatedParamsForSelectColumnData($table, $column);;
        
        $data = Event::dispatch('record.selectColummnData.requested', [$column, $params])[0];
                
        send_log('info', 'Response Select Column Data In Archive', $data);
        
        return response()->json($data);
    }
    
    public function getSelectColumnDataInDeleted (User $user, BaseModel $table, BaseModel $column)
    {
        send_log('info', 'Request Select Column Data In Deleted', $column);
        
        $params = $this->getValidatedParamsForSelectColumnData($table, $column);;
        
        $data = Event::dispatch('record.selectColummnData.requested', [$column, $params])[0];
                
        send_log('info', 'Response Select Column Data In Deleted', $data);
        
        return response()->json($data);
    }
    
    public function getRelationTableData(User $user, BaseModel $table, BaseModel $record, $tree)
    {
        send_log('info', 'Request Relation Table Data', [$record, $tree]);
        
        if(Gate::denies('treeIsPermittedForRelationTableData', [$tree])) $this->abort();
        
        $params = $this->getValidatedParamsForRelationTableData($tree);
        $params->data = $record;
        
        $data = Event::dispatch('record.realtionTableData.requested', [$record, $params])[0];
        
        send_log('info', 'Response Relation Table Data', $data);
        
        return helper('response_success', $data);
    }
    
    public function search(User $user, BaseModel $table, $words)
    {
        send_log('info', 'Request Quick Search In Table', [$table, $words]);
        
        $params = $this->getValidatedParamsForQuickSearch();       
        if(Gate::denies('viewAny', $params)) $this->abort();
        
        $data = Event::dispatch('record.quickSearch.requested', [$table, $params, $words])[0];
        
        send_log('info', 'Response Quick Search In Table', $data);
        
        return helper('response_success', $data);
    }
}
