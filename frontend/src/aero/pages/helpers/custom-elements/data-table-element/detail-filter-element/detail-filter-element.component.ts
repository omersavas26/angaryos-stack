import { Component, EventEmitter, Input, Output } from '@angular/core';

import { BaseHelper } from './../../../base';
import { MessageHelper } from './../../../message';
import { DataHelper } from './../../../data';
 
declare var $: any;

@Component(
{
    selector: 'detail-filter-element', 
    styleUrls: ['./detail-filter-element.component.scss'],
    templateUrl: './detail-filter-element.component.html'
})
export class DetailFilterElementComponent
{
    @Input() filterJson: string;
    @Input() baseUrl: string;
    @Input() displayName: string;
    @Input() showButtons: boolean = true;

    @Output() changed = new EventEmitter();
    @Output() formElementChanged = new EventEmitter();

    filterObject = null;
    show = false;
    
    constructor(private messageHelper: MessageHelper) {}
    
    ngAfterViewInit() 
    {
        this.updateData();
    }
    
    ngOnChanges()
    {
        this.updateData();
    }
    
    updateData()
    {
        try
        {
            this.filterObject = BaseHelper.jsonStrToObject(this.filterJson);
            this.filterObject['guiTypeForQuery'] = this.getColumnGuiTypeForQuery(this.filterObject['guiType']);
            setTimeout(() => this.show = true, 200); 
        }
        catch(err)
        {
            console.log(err);
        }
    }

    getLocalKey(attr)
    {
        return "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+"."+attr;
    }

    detailFilter(emitter = null, event = null)
    {     
        var closeModal = false;
        
        if(emitter == null)
        {
            emitter = this.changed;
            closeModal = true;
        }
        
        var filter = this.filterObject;
        var fullnes = $('#'+this.filterObject['columnName']+'data_fullness_state').val();
        if(fullnes.length > 0)
        {
            filter.type = parseInt(fullnes);
            filter.filter = null;
        }
        else
        {
            var id = '#'+filter['columnName']+'_filter_detail';
            filter.type = parseInt($(id+'_filter_type').val());
            filter.filter = $(id).val();
                        
            switch(filter.guiType)
            {
                case 'datetime':
                case 'date':
                case 'time':
                    filter.filter2 = DataHelper.changeDataForFilterByGuiType(
                                                                filter.guiType, 
                                                                $(id+"_2").val(), 
                                                                filter['columnName']+'_filter_detail', 
                                                                filter.columnName,
                                                                this.getLocalKey("data"));
                    break;
            }
            
            filter.filter = DataHelper.changeDataForFilterByGuiType(
                                                                    filter.guiType, 
                                                                    filter.filter, 
                                                                    filter['columnName']+'_filter_detail', 
                                                                    filter.columnName,
                                                                    this.getLocalKey("data"));
        } 

        if(event != null) filter.event = event;
        
        emitter.emit(filter);
        
        if(closeModal) $('#detailFilterModal').modal('hide');
    } 
    
    formElementChangeEvent(event)
    {
        this.detailFilter(this.formElementChanged, event);
    }

    getColumnGuiTypeForQuery(guiType)
    {
        switch (guiType) 
        {
            case 'text': return 'string';
            case 'select': return 'multiselect';
            case 'point': return 'multipolygon';
            default: return guiType;
        }
    }  
}