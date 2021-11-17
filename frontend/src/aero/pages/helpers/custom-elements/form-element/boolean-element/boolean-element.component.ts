import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DataHelper } from './../../../data';

@Component(
{
    selector: 'boolean-element',
    styleUrls: ['./boolean-element.component.scss'],
    templateUrl: './boolean-element.component.html'
})
export class BooleanElementComponent
{
    @Input() defaultData: string;
    @Input() value: string;
    @Input() guiType: string;
    @Input() class: string;
    @Input() name: string;
    @Input() placeholder: string;
    @Input() showFilterTypesSelect: boolean;
    @Input() createForm: boolean = false;
    @Input() filterType: string;

    displayNameForTrue = "true";
    displayNameForFalse = "false";

    @Output() changed = new EventEmitter();
    
    constructor()
    {
        setTimeout(() => 
        {
            this.updateData();
        }, 50);
    }
    
    ngOnChanges()
    {
        this.updateData();
    }
    
    updateData()
    {
        this.displayNameForTrue = DataHelper.convertDataByGuiTypeBoolean(null, null, this.guiType, true);
        this.displayNameForFalse = DataHelper.convertDataByGuiTypeBoolean(null, null, this.guiType, false); 

        if(this.value != null && this.value.length > 0)
        {
            if(this.value == "1") this.value = "true";
            else if(this.value == "0") this.value = "false";

            return;
        }

        if(this.createForm != true) return;
        if(this.defaultData.length == 0) return;

        this.setDefaultData();
    }
    
    clearValue($event)
    {
        this.value = "";
        setTimeout(() => this.handleChange(event), 400);
    }

    handleChange(event)
    {
        this.changed.emit(event);
    }

    getDisplayName(data)
    {
        if(data) return this.displayNameForTrue;
        else return this.displayNameForFalse;
    }

    setDefaultData()
    {
        if(this.defaultData === "true")
            this.value = "true";
        else if(this.defaultData === "false")
            this.value = "false";
    }
}