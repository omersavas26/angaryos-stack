import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AeroThemeHelper } from './../../../aero.theme';
import { BaseHelper } from './../../../base';

declare var $: any;

@Component(
{
    selector: 'date-element',
    styleUrls: ['./date-element.component.scss'],
    templateUrl: './date-element.component.html'
})
export class DateElementComponent
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
        
        this.val = BaseHelper.dBDateStringToHumanDateString(this.value);
        this.val2 = BaseHelper.dBDateStringToHumanDateString(this.value2);
    }

    filterTypeChanged(e)
    {
        this.filterType = e.target.value;
        this.changed.emit(event)
    }

    addInputMask()
    {
        $('[name="'+this.name+'"]').inputmask('d/m/y', 
        {
            hourFormat: '24',
            alias: 'date',//            alias: 'datetime',
            placeholder: '__/__/____',
            oncomplete: (event) => this.changed.emit(event),
            oncleared: (event) => this.changed.emit(event)
        });

        $('[name="'+this.name+'_2"]').inputmask('d/m/y', 
        {
            hourFormat: '24',
            alias: 'date',//            alias: 'datetime',
            placeholder: '__/__/____',
            oncomplete: (event) => this.changed.emit(event),
            oncleared: (event) => this.changed.emit(event)
        });
    }
}