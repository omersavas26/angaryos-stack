import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AeroThemeHelper } from './../../../aero.theme';
import { BaseHelper } from './../../../base';

declare var $: any;

@Component(
{
    selector: 'time-element',
    styleUrls: ['./time-element.component.scss'],
    templateUrl: './time-element.component.html'
})
export class TimeElementComponent
{
    @Input() defaultData: string;
    @Input() upFormId: string;
    @Input() value: string;
    @Input() value2: string;
    @Input() name: string;
    @Input() class: string;
    @Input() placeholder: string;
    @Input() showFilterTypesSelect: boolean;
    @Input() filterType: string;
    @Input() createForm: boolean = false;

    val = "";
    val2 = "";

    @Output() changed = new EventEmitter();

    constructor(private aeroThemeHelper: AeroThemeHelper) {}

    ngAfterViewInit()
    {
        this.elementOperations();
    }

    elementOperations()
    {      
        BaseHelper.getScript('assets/themes/aero/assets/plugins/jquery-inputmask/jquery.inputmask.bundle.js', 
            () => this.addInputMask());        
    }

    ngOnChanges()
    {
        if(this.createForm && this.defaultData.length > 0) this.value = this.defaultData;
        
        this.val = this.value;
        this.val2 = this.value2;
    }

    filterTypeChanged(e)
    {
        this.filterType = e.target.value;
        this.changed.emit(event);
    }

    addInputMask()
    {
        $('[name="'+this.name+'"]').inputmask('h:s:s', 
        {
            hourFormat: '24',
            alias: 'time',//            alias: 'datetime',
            placeholder: '__:__:__',
            oncomplete: (event) => this.changed.emit(event),
            oncleared: (event) => this.changed.emit(event)
        });

        $('[name="'+this.name+'_2"]').inputmask('h:s:s', 
        {
            hourFormat: '24',
            alias: 'time',//            alias: 'datetime',
            placeholder: '__:__:__',
            oncomplete: (event) => this.changed.emit(event),
            oncleared: (event) => this.changed.emit(event)
        });
    }
}