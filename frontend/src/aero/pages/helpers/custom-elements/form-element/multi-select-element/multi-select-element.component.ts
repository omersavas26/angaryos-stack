import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BaseHelper } from './../../../base';
import { DataHelper } from './../../../data';
import { SessionHelper } from './../../../session';
import { MessageHelper } from './../../../message';
import { AeroThemeHelper } from './../../../aero.theme';

declare var $: any;

@Component(
{
    selector: 'multi-select-element',
    styleUrls: ['./multi-select-element.component.scss'],
    templateUrl: './multi-select-element.component.html'
})
export class MultiSelectElementComponent
{
    @Input() defaultData: string;
    @Input() recordJson: string; 
    @Input() baseUrl: string;
    @Input() type: string;
    @Input() value: string;
    @Input() valueJson: string = "";
    @Input() class: string;
    @Input() name: string;
    @Input() columnName: string;
    @Input() placeholder: string;
    @Input() showFilterTypesSelect: boolean;
    @Input() filterType: string;
    @Input() upColumnName: string;
    @Input() upFormId: string = "";
    @Input() showClearDataButton: boolean = false;
    @Input() createForm: boolean = false;
    
    @Output() changed = new EventEmitter();
    
    record = null;
    selectObject = null
    
    baseElementSelector = "";
    val = [];
    selectedVal = [];
    deletedVal = [];
    addedVal = [];
    
    constructor(
        private messageHelper: MessageHelper,
        private sessionHelper: SessionHelper,
        private aeroThemeHelper: AeroThemeHelper
    ) { }

    ngAfterViewInit()
    {         
        if(this.upFormId.length > 0) 
            this.baseElementSelector = '#'+this.upFormId+'inFormModal ';

        //this.elementOperationsInterval();
        var e = $(this.baseElementSelector+' select[name="'+this.name+'"]');
        e.html(e.html()+" ");
    }
    
    ngOnChanges()
    {   
        if(typeof this.recordJson != "undefined" && this.recordJson != "")
            this.record = BaseHelper.jsonStrToObject(this.recordJson);
            
        if(this.createForm || this.valueJson.length > 0) 
        {
            var key = "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+".data";
            
            this.val = [];
            this.selectedVal = []
            var temp = [];
            
            if(this.createForm)
            {
                if(this.defaultData == null || this.defaultData == "") 
                {
                    this.elementOperationsInterval();
                    return;
                }

                temp = BaseHelper.jsonStrToObject(this.defaultData);
            }
            else
                temp = BaseHelper.jsonStrToObject(this.valueJson);
            
            if(temp == null)
            {
                this.elementOperationsInterval();
                return;
            }
            
            for(var i = 0; i < temp.length; i++)
            {
                if(this.deletedVal.includes(temp[i]['source'].toString())) continue;
                
                this.val.push(temp[i]['source']);
                this.selectedVal.push(temp[i]['source']);

                var tempKey = key + ".selectQueryElementDataCache."+this.name+"."+temp[i]['source'];
                BaseHelper.writeToLocal(tempKey, temp[i]['display']);
            }
            
            setTimeout(() => 
            {
                $(this.baseElementSelector+' [name="'+this.name+'"]').val(this.selectedVal);
                $(this.baseElementSelector+' [name="'+this.name+'"]').trigger('change');
            }, 200)
        }
        else if(this.value.substr(0,1) == '[')
            this.val = BaseHelper.jsonStrToObject(this.value);
        else if(this.value == '')
            this.val = [];
        else
            this.val = this.value.split(","); 
            
        this.elementOperationsInterval();
    }
    
    elementOperationsInterval()
    {
        var intervalName = 'multiselectElementOperations.'+this.name+".";
        if(this.record != null) intervalName += this.record['id'];
        
        return BaseHelper.doInterval(
                intervalName, 
                (th) => th.elementOperations(), 
                this, 
                200);
    }
    
    elementOperations()
    {              
        BaseHelper.getScript('assets/ext_modules/select2/select2.min.js', () => 
        {
            switch(this.type)
            {
                case 'multiselect:static':
                    this.addSelect2Static();
                    break; 
                default:
                    this.addSelect2();
                    break;
            }
        });        
    }
    
    addSelect2Static()
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += this.baseUrl;
        url += "/getSelectColumnData/"+this.columnName+"?search=***&page=1&limit=500";
        
        if(!this.createForm) url += '&editRecordId='+this.record['id'];
        
        if(this.upColumnName.length > 0) 
        {
            url += '&upColumnName='+this.upColumnName;
            url += '&upColumnData='+$('#'+this.upColumnName).val();
            
            var temp = BaseHelper.getAllFormsData(this.baseElementSelector);
            url += '&currentFormData='+BaseHelper.objectToJsonStr(temp);
        }
        
        var th = this;
        
        $.ajax(
        {
            url : url,
            type : "POST",
            data : {},
            success : async (data) =>
            {
                if(typeof data['results'] == 'undefined')
                {
                    this.messageHelper.sweetAlert("Sunucudan 'multi-select' için data getirilirken hata oluştu", "Hata", "warning");
                }
                else
                {
                    var element = $(this.baseElementSelector+' [name="'+this.name+'"]');
                    
                    for(var i = 0; i < data['results'].length; i++)
                    {
                        var item = data['results'][i];
                        
                        if(this.val.includes(item['id'])) continue;
                        if(element.find("option[value='"+item['id']+"']").length > 0) continue;
                        
                        var html = "<option value='"+item['id']+"'>"+item['text']+"</option>";
                        element.append(html);
                    }
                    
                    try 
                    { 
                        element.select2(
                        {
                            allowClear: true,
                            placeholder: $(this.baseElementSelector+' [name="'+this.name+'"] span').html(),
                            templateSelection: function (data, container) 
                            {
                                $(data.element).attr('item-source', data.id);
                                return data.text;
                            }
                        })
                        .on('select2:select', (event) => 
                        {
                            if(event.target.value == '-9999')
                            {
                                $(th.baseElementSelector+' [name="'+th.name+'"]').val("");
                                $(th.baseElementSelector+' #select2-'+th.name+'-container').html("");
                                return;
                            }
                            this.changed.emit(event);
                        })
                        .on('select2:unselect', (event) => this.changed.emit(event));

                        $(document).on('click', th.baseElementSelector+' #'+th.name+'-group .select2-selection__choice', function(e) 
                        {
                            var elementId = th.baseElementSelector+' #'+th.name+'-group multi-select-element ';
                            console.log(elementId);
                            
                            $(elementId+' .select2-selection__choice')
                            .each((i, opt) => $(opt).removeClass('selected-option'));

                            $(e.target).addClass('selected-option');

                            $(elementId+" select").select2('close');
                        });
                        
                        setTimeout(() => element.select2('enable', [true]), 500);
                    }
                    catch(err2)
                    {
                        console.log(this.name+' select2 (multi) yüklenmemiş tekrar denenecek!')
                        await BaseHelper.sleep(100);
                        this.elementOperations();
                        return;
                    }
                }
            },
            error : (e) =>
            {
                this.messageHelper.toastMessage("Bir hata oluştu", "warning");
            }
        });
    }

    async addSelect2()
    {
        $(this.baseElementSelector+' [name="'+this.name+'"]').val(this.val)
        
        var url = BaseHelper.backendUrl + BaseHelper.token;
        url += "/"+this.baseUrl + "/getSelectColumnData/" + this.columnName;
        
        var th = this;
        
        try 
        { 
            if(this.selectObject != null) this.selectObject.select2("destroy");
            this.selectObject = $(this.baseElementSelector+' [name="'+this.name+'"]').select2(
            {
                ajax: 
                {
                    url: url,
                    type: "POST",
                    dataType: 'json',
                    delay: 1000,
                    cache: false,
                    data: function (params) 
                    {
                        var r = new Object();

                        r['search'] = params['term'];
                        r['page'] = params['page'];

                        if(!th.createForm && th.record != null) r['editRecordId'] = th.record['id'];

                        if(th.upColumnName.length == 0) return r;

                        r['upColumnName'] = th.upColumnName;
                        r['upColumnData'] = $('#'+th.upColumnName).val();

                        var temp = BaseHelper.getAllFormsData(this.baseElementSelector);
                        r['currentFormData'] = BaseHelper.objectToJsonStr(temp);

                        return r;
                    }
                },

                allowClear: this.showClearDataButton,
                closeOnSelect: false,
                minimumInputLength: 3,
                placeholder: th.placeholder,
                sorter: function(data) 
                {
                    return data.sort(function(a, b) 
                    {
                        return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
                    });
                },
                templateSelection: function (data, container) 
                {
                    $(data.element).attr('item-source', data.id);
                    return data.text;
                }
            })
            .on('select2:select', (event) => th.selected(event))
            .on('select2:unselect', (event) => th.unselected(event));
            
            setTimeout(() => $(this.baseElementSelector+' [name="'+this.name+'"]').select2('enable', [true]), 500);
        }
        catch(err2)
        {
            console.log(this.name+' select2 (multi) yüklenmemiş tekrar denenecek!')
            await BaseHelper.sleep(100);
            this.elementOperations();
            return;
        }
        
        this.addStyle();

        var th = this;         
        $(document).on('click', th.baseElementSelector+' #'+th.name+'-group .select2-selection__choice', function(e) 
        {
            var elementId = '#'+th.name+'-group multi-select-element ';
            console.log(elementId);
            
            $(elementId+' .select2-selection__choice')
            .each((i, opt) => $(opt).removeClass('selected-option'));

            $(e.target).addClass('selected-option');

            $(elementId+" select").select2('close');
        });
    }

    selected(event)
    {
        var id = event.params.data.id.toString();
        if(this.deletedVal.includes(id))
        {
            for(var i = 0; i < this.deletedVal.length; i++)
                if(id == this.deletedVal[i])
                {
                    this.deletedVal.splice(i, 1);
                    break;
                }
        }
        
        this.clearAndCacheDisplayNameOptions();
        this.changed.emit(event);
    }

    unselected(event)
    {
        var id = event.params.data.id.toString();
        if(!this.deletedVal.includes(id)) this.deletedVal.push(id);
        
        this.clearAndCacheDisplayNameOptions();
        this.changed.emit(event);
    }

    filterTypeChanged(event)
    {
        this.changed.emit(event);
    }
    
    clearAndCacheDisplayNameOptions()
    {
        var localKey = "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+"/form";
        $(this.baseElementSelector+' [name="'+this.name+'"] option[value="-9999"]').remove();
        var data = DataHelper.changeDataForFilterByGuiTypeSelectAndMultiSelect(this.columnName, this.name, localKey);
        return data;
    }

    addStyle()
    {
        if(this.class.indexOf('column-filter') == -1) return;
        
        $('.select2-results__options').css('font-size', '12px');

        $(".select2").css('font-size', '12px');
        $(".select2").css('margin', '4px');
        $(".select2").css('width', '100%');
        $(".select2 input").css('width', '100%');
        $(".select2-selection").css('border-color', '#ccc');
        $('.select2-selection, select2-selection--multiple').css('min-height', '25px');
        $('.select2 input').css('margin', '3px 0');
        $('.select2-selection__choice').css('padding-left', '2px');
        $('.select2-selection__choice').css('margin', '2px 2px 2px 0');
        $('.select2-selection--multiple').css('width', '100%');
        
        setTimeout(() => $('.select2-selection--multiple').css('display', 'inline-table'), 200);
    }

    getDisplayName(value)
    {
        var key = "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+".data";
        key += ".selectQueryElementDataCache."+this.columnName+"."+value;
        return BaseHelper.readFromLocal(key); 
    }

    getValue()
    {
        return this.val;
    }
}