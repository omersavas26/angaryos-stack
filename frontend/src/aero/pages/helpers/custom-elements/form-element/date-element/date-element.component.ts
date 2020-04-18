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
    @Input() default: string;
    @Input() value: string;
    @Input() name: string;
    @Input() class: string;
    @Input() placeholder: string;
    @Input() showFilterTypesSelect: boolean;
    @Input() filterType: string;

    val = "";

    @Output() changed = new EventEmitter();

    constructor(private aeroThemeHelper: AeroThemeHelper) {}

    ngAfterViewInit()
    {
        this.elementOperations();
    }

    async waitForInputmaskLibrary()
    {
        await BaseHelper.waitForOperation(() => $('test').inputmask() );
    }

    async elementOperations()
    {      
        await this.waitForInputmaskLibrary();

        this.addInputMask();
    }

    ngOnChanges()
    {
        this.val = BaseHelper.dBDateStringToHumanDateString(this.value);
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
    }
}