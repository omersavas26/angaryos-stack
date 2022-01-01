import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BaseHelper } from './../../../base';
import { SessionHelper } from './../../../session';
import { MessageHelper } from './../../../message';
import { AeroThemeHelper } from './../../../aero.theme';

declare var $: any;

@Component(
{
    selector: 'select-element',
    styleUrls: ['./select-element.component.scss'],
    templateUrl: './select-element.component.html'
})
export class SelectElementComponent
{
    @Input() defaultData: string;
    @Input() recordJson: string; 
    @Input() baseUrl: string;
    @Input() type: string;
    @Input() value: string;
    @Input() valueJson: string;
    @Input() class: string;
    @Input() name: string;
    @Input() columnName: string;
    @Input() placeholder: string;
    @Input() showFilterTypesSelect: boolean;
    @Input() filterType: string;
    @Input() upColumnName: string;
    @Input() upFormId: string = "";
    @Input() createForm: boolean = false;
    
    record = null;

    baseElementSelector = "";
    val = [];

    @Output() changed = new EventEmitter();
    
    constructor(
        private messageHelper: MessageHelper,
        private sessionHelper: SessionHelper,
        private aeroThemeHelper: AeroThemeHelper
    ) 
    { }

    ngAfterViewInit()
    {
        if(this.upFormId.length > 0)
            this.baseElementSelector = '#'+this.upFormId+'inFormModal ';

        this.elementOperations(); 
    }

    ngOnChanges()
    {
        if(typeof this.recordJson != "undefined" && this.recordJson != "")
            this.record = BaseHelper.jsonStrToObject(this.recordJson);
            
        if(this.createForm || this.valueJson.substr(0,1) == '[')
        {
            var key = "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+".data";
            
            this.val = [];
            var temp = [];
            
            if(this.createForm)
            {
                if(this.defaultData == null || this.defaultData == "") return;

                temp = BaseHelper.jsonStrToObject(this.defaultData);
            }
            else
                temp = BaseHelper.jsonStrToObject(this.valueJson);

            for(var i = 0; i < temp.length; i++)
            {
                this.val.push(temp[i]['source']);

                var tempKey = key + ".selectQueryElementDataCache."+this.name+"."+temp[i]['source'];
                BaseHelper.writeToLocal(tempKey, temp[i]['display']);
            }
        }
        else
            this.val = this.value.split(",");
    }

    elementOperations()
    {      
        BaseHelper.getScript('assets/ext_modules/select2/select2.min.js', async () => 
        {
            switch(this.type)
            {
                case 'select:static':
                    this.addSelect2Static();
                    break;
                default:
                    this.addSelect2();
                    break;
            }
            
            this.addStyle(); 
        });        
    }

    handleChange(event)
    {
        this.changed.emit(event);
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
                    this.messageHelper.sweetAlert("Sunucudan selectElement için data seti alınamadı!", "Hata", "warning");
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
                        
                        setTimeout(() => element.select2('enable', [true]), 500);
                    }
                    catch(err2)
                    {
                        console.log(this.name+' select2 yüklenmemiş tekrar denenecek!')
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
            await $(this.baseElementSelector+' [name="'+this.name+'"]').select2(
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
                allowClear: true,
                minimumInputLength: 3,
                placeholder: $(this.baseElementSelector+' [name="'+this.name+'"] span').html(),
                sorter: function(data) 
                {
                    return data.sort(function(a, b) 
                    {
                    return a.text < b.text ? -1 : a.text > b.text ? 1 : 0;
                    });
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
            
            setTimeout(() => $(this.baseElementSelector+' [name="'+this.name+'"]').select2('enable', [true]), 500);
        }
        catch(err2)
        {
            console.log(this.name+' select2. yüklenmemiş tekrar denenecek!')
            await BaseHelper.sleep(100);
            this.elementOperations();
            return;
        }
    }

    addStyle()
    {
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
    }

    getDisplayName(value)
    {
        var key = "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+".data";
        key += ".selectQueryElementDataCache."+this.name+"."+value;
        return BaseHelper.readFromLocal(key); 
    }

    getValue()
    {
        return this.val;
    }
}