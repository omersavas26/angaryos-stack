import { ActivatedRoute} from '@angular/router';
import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';
import { NativeAudio } from '@ionic-native/native-audio/ngx';

import { BaseHelper } from './../../base';
import { DataHelper } from './../../data';
import { MessageHelper } from './../../message';
import { SessionHelper } from './../../session';
import { GeneralHelper } from './../../general';
import { AeroThemeHelper } from './../../aero.theme';

declare var $: any;

@Component(
{
    selector: 'data-table-element', 
    styleUrls: ['./data-table-element.component.scss'],
    templateUrl: './data-table-element.component.html'
})
export class DataTableElementComponent implements OnDestroy 
{
    @Input() baseUrl: string;
    @Input() tableName: string = "";
    @Input() defaultLimit: number = 10;
    @Input() lightTable: boolean = false;
    @Input() archiveTable: boolean = false;
    
    @Output() dataChanged = new EventEmitter();

    objectId = null;

    showEditButton = {};
    selectedFilter = null;
    selectedRecord = null;
    selectedRecordList = [];
    loadDataTimeout = 2000;

    inFormColumnName = "";
    inFormTableName = "";
    inFormRecordId = 0;
    inFormElementId = "";

    data = null;
    params = null;
    reports = null;
    iconVisibility = null;
    recordOperations = null;
    fullBaseUrl = "";
    
    marked = [];
    
    isNative = null;
    
    currentGroupByColumnDataSet = null;
    started = false;

    constructor(
        public route: ActivatedRoute,
        public messageHelper: MessageHelper,
        public sessionHelper: SessionHelper,
        public generalHelper: GeneralHelper,
        public aeroThemeHelper: AeroThemeHelper,
        private sanitizer:DomSanitizer,
        private nativeAudio: NativeAudio
    ) 
    {
        this.objectId = Math.random();

        this.fillDefaultVariables();
        this.addEventForThemeIcons();

        setTimeout(() => this.preLoadInterval(), 100);
        
        if(BaseHelper.isAndroid || BaseHelper.isIos) this.isNative = true;
    }

    ngAfterViewInit() 
    {    
        if(!BaseHelper.isBrowser) 
            setTimeout(() => {
                $('section').css('margin', '0px');
            }, 100);
    }
    
    ngOnChanges()
    {
        this.preLoadInterval();
    }
    
    ngOnInit() 
    {
        this.themeOperations();
    }

    ngOnDestroy()
    {
        BaseHelper.clearLiveDataModeIntervals();
    }

    preLoadInterval()
    {
        return BaseHelper.doInterval(
                'dataTablePreLoad'+this.objectId, 
                (th) => th.preLoad(), 
                this, 
                200);
    }
    
    preLoad()
    {
        this.fillDefaultVariables();
        this.fillParamsFromLocal();
                
        if(Object.keys(this.params["filters"]).length > 0)
        {
            this.started = true;
            this.dataReload();
        } 
        else this.groupBySelectionNext();
        
        this.liveDataModeOperations();
    }
    
    groupByModalOptions(columnName)
    {
        var th = this;
        
        setTimeout(() =>
        {
            $('#groupByModeModal').on('hidden.bs.modal', function (e) 
            {
                th.started = true;
                th.dataReloadInterval(300);
            });
            
            BaseHelper.getScript('assets/ext_modules/select2/select2.min.js', async () => 
            {
                $('#groupByDataSelect'+columnName).select2()
                .on('select2:select', (event) => 
                {
                    var cName = th.currentGroupByColumnDataSet['columnName'];
                    var gName = th.currentGroupByColumnDataSet['columnGuiTypeName'];
                
                    var val = $('#groupByDataSelect'+cName).val();
                    th.groupByDataSelected(cName, gName, val)
                }); 
            });              
        }, 300); 
    }
    
    liveDataModeOperations()
    {  
        BaseHelper.clearLiveDataModeIntervals();
        if(!this.params.liveDataMode) return;
        
        var temp = setInterval(() => 
        {
            this.dataReload(true);
        }, 1000 * 15);
        BaseHelper.liveDataModeIntervalIds.push(temp);
    }
    
    fillDefaultVariables()
    {
        this.recordOperations = DataHelper.recordOperations;
        this.fullBaseUrl = this.getTablePageBaseUrl();
        
        this.data = {};        
        this.data['table_info'] = {};
        this.data['table_info']['display_name'] = ""; 
        this.data['table_info']['up_table'] = ""; 
        this.data['allColumns'] = {};        
        this.data['query_columns'] = {};        
        this.data['columns'] = {};        
        this.data['records'] = [];        
        this.data['loaded'] = false;
        
        this.iconVisibility = {};
        this.iconVisibility['download'] = !this.lightTable && !this.archiveTable;
        this.iconVisibility['deleted'] = !this.lightTable && !this.archiveTable && this.can('deleted');
        this.iconVisibility['create'] = !this.lightTable && !this.archiveTable && this.can('create');
        this.iconVisibility['editMode'] = !this.lightTable && !this.archiveTable;
        this.iconVisibility['liveDataMode'] = !this.lightTable && !this.archiveTable;
        this.iconVisibility['recodOperations'] = !this.lightTable && !this.archiveTable;
        this.iconVisibility['selectAsUpTable'] = this.can('selectAsUpTable') && !this.archiveTable;
        this.iconVisibility['authWizard'] = this.can('authWizard') && !this.archiveTable
        this.iconVisibility['dataEntegrator'] = this.can('dataEntegrator') && !this.archiveTable;
        
        this.params = this.getDefaultParams();
        
        this.reports = {};
        this.reports['table'] = [];
        this.reports['record'] = [];
        
        var reportsAuth = BaseHelper.loggedInUserInfo['reports'];
        if(typeof reportsAuth[this.tableName] == "undefined") return;
        
        var keys = Object.keys(reportsAuth[this.tableName]);
        for(var i = 0; i < keys.length; i++)
            this.reports[keys[i]] = reportsAuth[this.tableName][keys[i]];
    }
    
    getDefaultParams()
    {
        return {
            page: 1,
            limit: 10,
            column_array_id: 0,
            column_array_id_query: 0,
            sorts: {},
            filters: {},
            editMode: false,
            liveDataMode: false,
            columnNames: [],
            groupBy: []
        };
    }
    
    fillParamsFromLocal()
    {  
        this.params = this.getDefaultParams();
        this.params.limit = this.defaultLimit;

        var temp = this.getLocalVariable("params");
        if(temp != null) this.params = temp;
        
        this.params['filterColumnNames'] = Object.keys(this.params['filters']);
        for(var i = 0; i < this.params['filterColumnNames'].length; i++)
        {
            var filterColumnName = this.params['filterColumnNames'][i];
            var desc = this.getFilterDescription(filterColumnName);
            this.params['filters'][filterColumnName]['description'] = desc;            
        }
             
        if(this.params["columnNames"].length == 0) 
            this.params["columnNames"] = Object.keys(this.data['columns']);
        
        if(this.tableName.indexOf('tree:') == -1)
        {
            var auth = BaseHelper.loggedInUserInfo.auths['tables'][this.tableName];

            var segments = this.baseUrl.split('/');
            var segment = segments[segments.length -1];
            
            var listAuthType = (segment == 'deleted') ? 'deleteds' : 'lists';            
            var listId = 0;
            if(typeof auth[listAuthType] != "undefined" && typeof auth[listAuthType][0] != "undefined")
                listId = auth[listAuthType][0]

            var queryId = listId;
            if(typeof auth['queries'] != "undefined" && typeof auth['queries'][0] != "undefined")
                queryId = auth['queries'][0]
                
            this.params.column_array_id = listId;
            this.params.column_array_id_query = queryId;
        }
        else
        {
            var temp:any = this.tableName.replace('tree:', '').split(':');
            this.params.column_array_id = temp[1];
            this.params.column_array_id_query = temp[1];
        }
        
        if(typeof this.params["groupBy"] == "undefined") this.params["groupBy"] = [];
    }
    
    getLocalVariable(name)
    {
        var key = this.getLocalKey(name);
        return BaseHelper.readFromLocal(key);
    }
    
    getLocalKey(name)
    {
        return "user:"+BaseHelper.loggedInUserInfo.user.id+"."+this.baseUrl+"."+name;
    }
    
    dataReloadInterval(timeout = null)
    {
        if(timeout == null) timeout = this.loadDataTimeout;
        
        return BaseHelper.doInterval(
                'dataTableDataReload', 
                (th) => th.dataReload(), 
                this, 
                timeout);
    }
    
    groupByDataSelected(columnName, guiType, source)
    {
        var filter = DataHelper.changeDataForFormByGuiType(guiType, source);
        
        var filterType = 1;        
        guiType = guiType.split(':')[0];
        switch(guiType)
        {
            case "boolean":
                if(filter == null || filter == "" || filter == "null")
                {
                    filter = null;
                    filterType = 100;
                }
                else console.log(filter);
                break;
        }
                
        var key = "groupBySelection:"+this.tableName+":"+columnName;
        BaseHelper.pipe[key] = filter;
        
        
        this.params.filters[columnName] = 
        {
            type: filterType,
            guiType: guiType,
            filter: filter,
            description: ""
        };
        
        this.params.filters[columnName]['description'] = this.getFilterDescription(columnName);
        this.params['filterColumnNames'].push(columnName);
        
        this.saveParamsToLocal();
        
        this.groupBySelectionNext();
    }
    
    showGroupByModal(columnName, upData)
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        url += this.baseUrl + "/groupBy/" + columnName+"?upData="+BaseHelper.objectToJsonStr(upData);
        
        this.sessionHelper.doHttpRequest("GET", url)
        .then((data) => 
        {
            for(var i = 0; i < data["records"].length; i++)
            {
                var record = { };
                record[columnName] = data["records"][i]["display"];
                data["records"][i]["display"] = DataHelper.convertDataForGui(record, columnName, data["columnGuiTypeName"]);
            }
            
            this.currentGroupByColumnDataSet = data;  
            
            var th = this;          
            setTimeout(() => 
            {
                $('#groupByModeModal').modal("show");
                th.groupByModalOptions(columnName);
            }, 200);
        });
    }
    
    groupBySelectionNext()
    {
        var upData = {};
        
        if(typeof this.params["groupBy"] != "undefined")
            for(var i = 0; i < this.params["groupBy"].length; i++)
            {
                var columnName = this.params["groupBy"][i];

                var key = "groupBySelection:"+this.tableName+":"+columnName;
                if(typeof BaseHelper.pipe[key] == "undefined")
                {
                    this.showGroupByModal(columnName, upData);                
                    return;
                }
                else upData[columnName] = BaseHelper.pipe[key];
                
                console.log(upData[columnName]);
            }
        
        if(($("#groupByModeModal").data('bs.modal') || {})._isShown)
            $('#groupByModeModal').modal('hide');
        else
        {
            this.started = true;
            this.dataReload();
        }
    }
    
    pageNameClicked()
    {
        if(!BaseHelper['pipe']['ctrlKey'])
        {
            this.dataReload();
            return;
        }
        
        this.params['filters'] = {};
        this.params['filterColumnNames'] = [];
        
        for(var i = 0; i < this.params["groupBy"].length; i++)
        {
            var columnName = this.params["groupBy"][i];
            var key = "groupBySelection:"+this.tableName+":"+columnName;
            delete BaseHelper.pipe[key];
        }
                
        this.saveParamsToLocal();
        
        this.groupBySelectionNext();
    }
    
    dataReload(liveDataIntervalTrigger = false)
    {        
        if(!this.started) return;
        
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += this.baseUrl;
        var temp = 
        {
            'params': BaseHelper.objectToJsonStr(this.params)
        };
        
        this.sessionHelper.doHttpRequest("POST", url, temp)
        .then((data) => this.dataLoaded(data, liveDataIntervalTrigger));
    }
    
    dataLoaded(data, liveDataIntervalTrigger)
    {
        if(liveDataIntervalTrigger) this.liveDataModeControl(data);
        
        this.data = this.fillDataAdditionalVariables(data);
        
        this.iconVisibility['selectAsUpTable'] = this.can('selectAsUpTable') && !this.archiveTable;
        
        this.fillParamsFromLocal();    
        
        this.themeOperations();
        
        $('#tableOperationsRow').css('display', 'table');
            
        this.dataChanged.emit(data);
    }
    
    liveDataModeControl(data)
    {
        if(!this.params.liveDataMode) return;
        if(!this.data['loaded']) return;
        
        var columnNames = Object.keys(data['columns']);
        for(var i = 0; i < data['records'].length; i++)
        {
            var newRecord = data['records'][i];
            var finded = false;
            
            for(var j = 0; j < this.data['records'].length; j++)
            {
                var oldRecord = this.data['records'][j];
                
                if(oldRecord["id"] == newRecord["id"])
                {
                    for(var k = 0; k < columnNames.length; k++)
                    {
                        var cn = columnNames[k];
                        
                        if(newRecord[cn] != oldRecord[cn])
                        {
                            this.markNewData(newRecord["id"], cn);
                        }
                    }
                    
                    finded = true;
                    break;
                }
            }
            
            if(!finded) this.markNewData(newRecord["id"]);
        }
    }
    
    ringTone()
    {
        BaseHelper.doInterval(
            'ringTone', 
            (th) => 
            {
                if(BaseHelper.isBrowser)
                {
                    var audio = new Audio(BaseHelper.backendBaseUrl+"assets/message.wav");
                    audio.play();
                }
                else
                {
                    th.nativeAudio.preloadSimple('uniqueId1',"/assets/message.wav").then(() =>
                    {
                        console.log("preload ok ring");
                        
                        th.nativeAudio.play('uniqueId1')
                        .then(
                        () =>
                        {
                            console.log("play ok ring"); 
                        },
                        (e) =>
                        {
                            console.log("play err ring");
                            console.log(e);
                        });
                    }, 
                    (e) =>
                    {
                        console.log("preload err ring");
                        console.log(e);
                    });
                }
            }, 
            this, 
            300);
    }
    
    markNewData(id, columnName = "***")
    {
        this.ringTone();
        
        var selector = '#record-'+id;
        if(columnName != "***") selector += '-column-'+columnName;
        
        setTimeout(() => $(selector).css('background-color', '#ffb6c1'), 500);
    }
    
    fillDataAdditionalVariables(data)
    {
        data['queryColumnNames'] = Object.keys(data['query_columns']);
        data['columnNames'] = Object.keys(data['columns']);
        
        data['filterDatas'] = {}
        data['collectiveInfosHtml'] = {};



        data['allColumns'] = {};
        for(var i = 0; i < data['columnNames'].length; i++)
            data['allColumns'][data['columnNames'][i]] = data['columns'][data['columnNames'][i]];

        for(var i = 0; i < data['queryColumnNames'].length; i++) 
            data['allColumns'][data['queryColumnNames'][i]] = data['query_columns'][data['queryColumnNames'][i]];
        


        for(var i = 0; i < data['columnNames'].length; i++)
        {
            var columnName = data['columnNames'][i];
            var guiType = data['columns'][columnName]['gui_type_name'];
            data['columns'][columnName]['filterTypeName'] = this.getColumnGuiTypeForQuery(guiType);
            
            data['columns'][columnName]['guiElementTypeName'] = this.getColumnType(data, columnName); 
            if(data['columns'][columnName]['guiElementTypeName'] == 'relation')
                data['columns'][columnName]['relationJson'] = this.getColumnRelationJson(data, columnName);
            
            data['filterDatas'][columnName] = "";
            if(typeof this.params['filters'][columnName] != "undefined")
                data['filterDatas'][columnName] = this.params['filters'][columnName]['filter'];
                
            data['collectiveInfosHtml'][columnName] = "";
            if(typeof data['collectiveInfos'] != "undefined")
                if(typeof data['collectiveInfos'][columnName] != "undefined")
                    data['collectiveInfosHtml'][columnName] = this.getCollectiveInfo(data, columnName);
        }
        
        var sortedColumns = Object.keys(this.params['sorts']);
        data['sorted'] = {}
        for(var i = 0; i < data['columnNames'].length; i++)
        {
            var columnName = data['columnNames'][i];
            data['sorted'][columnName] = sortedColumns.includes(columnName);
        }
        
        data['sortPriority'] = {};
        for(var i = 0; i < sortedColumns.length; i++) 
        {
            var columnName:any = sortedColumns[i];
            data['sortPriority'][columnName] = i+1;
        }
        
        for(var i = 0; i < data['records'].length; i++)
        {
            data['records'][i]['recordClass'] = this.getRecordRowClass(i, data['records'][i]);
            data['records'][i]['tdClases'] = {};
            data['records'][i]['convertedDatasForGui'] = {};
            data['records'][i]['operations'] = {};
            data['records'][i]['operationLinks'] = {};
            
            data['records'][i]['iconVisibility'] = {};
            data['records'][i]['iconVisibility']['userImitation'] = this.can('userImitation', data['records'][i]);
            data['records'][i]['iconVisibility']['missionTrigger'] = this.can('missionTrigger', data['records'][i]);
            
            for(var j = 0; j < DataHelper.recordOperations.length; j++)
            {
                var opt = DataHelper.recordOperations[j];
                data['records'][i]['operations'][opt['type']] = this.can(opt['type'], data['records'][i]);
                data['records'][i]['operationLinks'][opt['type']] = this.getOpperationLink(opt, data['records'][i]);
            }
            
            for(var j = 0; j < data['columnNames'].length; j++)
            {
                var columnName = data['columnNames'][j];
                data['records'][i]['tdClases'][columnName] = this.getEditTdClass(data['records'][i], columnName, data['columns'][columnName]['guiElementTypeName']);
                
                switch(data['columns'][columnName]['guiElementTypeName'])
                {
                    case 'file':
                        if(typeof data['records'][i]['fileUrls'] == "undefined") data['records'][i]['fileUrls'] = {};
                        
                        var fileUrls = this.getFileUrls(data['records'][i][columnName]);
                        for(var k = 0 ; k < fileUrls.length; k++)
                        {
                            fileUrls[k]['isImage'] = this.isImageFile(fileUrls[k]);
                            fileUrls[k]['iconUrl'] = this.getFileIconUrl(fileUrls[k]['org']);
                        }
                        
                        data['records'][i]['fileUrls'][columnName] = fileUrls;
                        break;
                    default:
                        var guiTypeName = data['columns'][columnName]["gui_type_name"];
                        var temp = this.convertDataForGui(data['records'][i], columnName, guiTypeName);
                        data['records'][i]['convertedDatasForGui'][columnName] = temp;
                }
                
            }
            
            data['records'][i]['json'] = BaseHelper.objectToJsonStr(data['records'][i]);
        }
        
        data['loaded'] = true; 
        
        return data;
    }
    
    getFileUrls(data)
    {
        if(data == null) return [];

        if(typeof data == "string")
            data = BaseHelper.jsonStrToObject(data);

        var rt = [];
        for(var i = 0; i < data.length; i++)
        {
            var temp = {};
            temp['small'] = BaseHelper.getFileUrl(data[i], 's_');
            temp['big'] = BaseHelper.getFileUrl(data[i], 'b_');
            temp['org'] = BaseHelper.getFileUrl(data[i], '');

            rt.push(temp);
        }
        
        return rt;
    }
    
    getFilterDescription(columnName) 
    {
        if(typeof this.data['allColumns'] == "undefined") return "";
        if(typeof this.data['allColumns'][columnName] == "undefined") return "";
        
        var displayName = this.data['allColumns'][columnName]['display_name'];
        
        var guiType = this.data['allColumns'][columnName]['gui_type_name'];
        guiType = this.getColumnGuiTypeForQuery(guiType);

        switch (this.params.filters[columnName]['type']) 
        {
            case 100: return displayName + ": <b>Boş Olanlar</b>";
            case 101: return displayName + ": <b>Boş Olmayanlar</b>";
            default: return displayName + ": " + DataHelper.getFilterDescriptionByColumnGuiType(
                                                        columnName,
                                                        guiType,
                                                        this.params.filters[columnName]['type'],
                                                        this.params.filters[columnName]['filter'],
                                                        this.getLocalKey("data"),
                                                        this.params.filters[columnName]);
        }
    }
    
    getColumnGuiTypeForQuery(guiType)
    {
        if(guiType == "multiselect:static") guiType = "multiselect";
        
        switch (guiType.split(':')[0]) 
        {
            case 'text': 
            case 'richtext': 
            case 'codeeditor': 
            case 'json': 
            case 'jsonb': 
            case 'jsonviewer': 
                return 'string';
            case 'select':
            case 'multiselectdragdrop':
                return 'multiselect';
            case 'point': 
            case 'multipoint': 
            case 'linestring': 
            case 'multilinestring':
            case 'polygon': 
                return 'multipolygon';
            case 'files': 
            case 'password': 
                return 'disable';
            case 'boolean': 
                return 'boolean';
            default: return guiType;
        }
    } 
    
    clearColumnFilter(columnName)
    {
        if(typeof this.params.filters[columnName] == "undefined") return;

        delete this.params.filters[columnName];
        
        for(var i = 0; i < this.params['filterColumnNames'].length; i++)
            if(this.params['filterColumnNames'][i] == columnName)
            {
                this.params['filterColumnNames'].splice(i, 1);
                break;
            }

        this.saveParamsToLocal();
        
        this.dataReload();
    }
    
    can(policyType, record = null)
    {
        if(this.tableName.length == 0) return false;
        if(typeof BaseHelper.loggedInUserInfo['auths']['tables'] == "undefined") return false;
        
        var tablesAuths = BaseHelper.loggedInUserInfo['auths']['tables'];
        var columnName = '';
        
        switch(policyType)
        {
            case 'edit': columnName = '_is_editable'; break;
            case 'delete': columnName = '_is_deletable'; break;
            case 'archive': columnName = '_is_restorable'; break;
            case 'export': columnName = '_is_exportable'; break;
            case 'show': columnName = '_is_showable'; break;
            case 'clone':
            case 'create':
                if(this.tableName.indexOf('tree:') > -1) return false;
                if(typeof tablesAuths[this.tableName]['creates'] == "undefined") return false;
                return tablesAuths[this.tableName]['creates'].length > 0
                break;
            case 'deleted':
                if(typeof tablesAuths[this.tableName]['deleteds'] == "undefined") return false;
                return tablesAuths[this.tableName]['deleteds'].length > 0
                break;
            case 'userImitation': return this.canUserImitation(record);
            case 'missionTrigger': return this.canMissionTrigger(record);
            case 'authWizard': return this.canAuthWizard();
            case 'dataEntegrator': return this.canDataEntegrator();
            case 'selectAsUpTable': return this.canSelectUpTable();
            case 'isRecordDataTransportTarget': return this.isRecordDataTransportTarget(record);
            
            default: console.log(policyType + ': not have can function'); return true;
        }

        if(typeof record[columnName] == "undefined" || record[columnName]) return true;
        
        return false;
    }
    
    isRecordDataTransportTarget(record)
    {
        var loggedInUserId = BaseHelper.loggedInUserInfo['user']['id'];
        var key = 'user:'+loggedInUserId+'.dataTransport';
        
        var temp = BaseHelper.readFromLocal(key);
        if(temp == null) return false;
        
        if(temp['tableName'] != this.tableName) return false;
        if(temp['recordId'] != record.id) return false;
        
        return true;
    }
    
    openDetailFilterModal(columnName)
    {
        if(typeof this.params.filters[columnName] == "undefined")
            this.selectedFilter = this.getBasicFilterObject(columnName);
        else
            this.selectedFilter = this.params.filters[columnName];
            
        this.selectedFilter['columnName'] = columnName;
        
        this.selectedFilter['json'] = "";
        this.selectedFilter['json'] = BaseHelper.objectToJsonStr(this.selectedFilter);
        
        setTimeout(() => $('#detailFilterModal').modal('show'), 200);
    }
    
    getBasicFilterObject(columnName)
    {
        return {
            type: 1,
            guiType: this.data['allColumns'][columnName]['gui_type_name'],
            filter: ""
        };
    }
    
    getReportFormat()
    {
        var types = ['xlsx', 'pdf', 'csv'];
        var format = prompt("Hangi formatta indirmek istersiniz? (xlsx, csv yada pdf)", "xlsx");
        if(!types.includes(format)) format = 'xlsx';
        
        return format;
    }
    
    downloadReport(report = null, recordId = null)
    { 
        var temp = BaseHelper.getCloneFromObject(this.params);
        temp['report_format'] = this.getReportFormat();
        
        if(recordId != null) temp['record_id'] = recordId;
        else temp['record_id'] = 0;
        
        if(report != null) temp['report_id'] = report['id'];
        else temp['report_id'] = 0;
        
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += this.baseUrl;
        url += "/report?params="+BaseHelper.objectToJsonStr(temp);

        this.generalHelper.navigate(url, true);
        //window.open(url, "_blank");
    }
    
    getTablePageBaseUrl()
    {
        return BaseHelper.baseUrl + "table/"+this.tableName+"/"; 
    }
    
    detailFilterChanged(filter)
    {
        if(filter.filter != null && filter.filter.length == 0)
        {
            delete this.params.filters[filter.columnName];
            
            for(var i = 0; i < this.params['filterColumnNames'].length; i++)
            if(this.params['filterColumnNames'][i] == filter.columnName)
            {
                this.params['filterColumnNames'].splice(i, 1);
                break;
            }
        }
        else
        {
            this.params.filters[filter.columnName] = filter;
        }
        
        this.params['page'] = 1;
        this.saveParamsToLocal();
        
        this.dataReload();
    }
    
    saveParamsToLocal()
    {
        BaseHelper.writeToLocal(this.getLocalKey("params"), this.params);
    }
    
    toggleEditMode()
    {
        this.params.editMode = !this.params.editMode;
        this.saveParamsToLocal();

        this.messageHelper.toastMessage("Düzenleme modu " + (this.params.editMode ? "aktif" : "pasif"));
    }
    
    toggleLiveDataMode()
    {
        this.params.liveDataMode = !this.params.liveDataMode;
        this.saveParamsToLocal();

        this.messageHelper.toastMessage("Canlı veri modu " + (this.params.liveDataMode ? "aktif" : "pasif"));
        this.liveDataModeOperations();
    }
    
    dropColumn(event: CdkDragDrop<string[]>) 
    {
        moveItemInArray(this.params['columnNames'], event.previousIndex, event.currentIndex);
        this.saveParamsToLocal();
    }

    showAllColumns()
    {
        this.params['columnNames'] = Object.keys(this.data['columns']);
        this.saveParamsToLocal();
    }

    hideAllColumns()
    {
        this.params['columnNames'] = [];
        this.saveParamsToLocal();
    }
    
    groupByModeSettingModalOpen()
    {
        $('#groupByModeSettingModal').modal('show');
    }
    
    columnVisibilityModalOpen()
    {
        $('#columnVisibilityModal').modal('show');
    }

    toggleColumnVisibility(columnName)
    {
        if(!this.params['columnNames'].includes(columnName))
        {
            this.params['columnNames'].push(columnName);
        }
        else
        {
            var len = this.params['columnNames'].length;
            for(var i = 0; i < len; i++)
                if(columnName == this.params['columnNames'][i])
                    this.params['columnNames'].splice(i, 1);
        }
        
        this.saveParamsToLocal();
    }
    
    toggleColumnGroupBy(columnName)
    {
        if(!this.params['groupBy'].includes(columnName))
        {
            this.params['groupBy'].push(columnName);
        }
        else
        {
            var len = this.params['groupBy'].length;
            for(var i = 0; i < len; i++)
                if(columnName == this.params['groupBy'][i])
                    this.params['groupBy'].splice(i, 1);
        }
        
        this.saveParamsToLocal();
    }
    
    sortByColumn(columnName)
    {
        if(typeof this.params['sorts'][columnName] == "undefined")
        {
            this.data['sorted'][columnName] = true;
            this.params['sorts'][columnName] = true;
        }
        else
        {
            this.data['sorted'][columnName] = true;
            
            if(this.params['sorts'][columnName]) 
                this.params['sorts'][columnName] = false;
            else
            {
                delete this.params['sorts'][columnName];
                this.data['sorted'][columnName] = false;
            }
        }
        
        this.saveParamsToLocal()
        this.dataReload();
    }
    
    filterChanged(columnName, event)
    {
        if(!this.addFilterFromEvent(columnName, event)) return;

        this.params['page'] = 1;
        this.saveParamsToLocal();
        
        var guiType = this.data['columns'][columnName]['gui_type_name'];
        
        if(guiType.indexOf("select") > -1)
        {
            window.location.href = BaseHelper.backendBaseUrl+"#/privacy-politica";
            //this.generalHelper.navigate('/privacy-politica');
            
            setTimeout(() => {
                window.location.href = BaseHelper.baseUrl + "table/"+this.tableName+"/";
                //this.generalHelper.navigate("table/"+this.tableName+"/");
            }, 5);
            return;
        }
        
        var to = null;
        if(typeof event['enterKey'] != "undefined") to = 10;
        else
        {
            switch(guiType.split(':')[0])
            {
                case 'boolean':
                case 'select':
                case 'multiselect':
                case 'multiselectdragdrop':
                case 'date':
                case 'time':
                case 'datetime':
                    to = 10;
                    break;
            }
        }
        
        this.dataReloadInterval(to);
    }
    
    addFilterFromEvent(columnName, event, filterType = -1)
    {
        if(filterType == -1)
        {
            if(typeof this.params.filters[columnName] != "undefined")
                filterType = this.params.filters[columnName].type;
            else
                filterType = 1;
        }

        return this.addFilterFromEventForBasicType(columnName, event, filterType);
    }

    addFilterFromEventForBasicType(columnName, event, filterType)
    {
        var guiType = this.data['columns'][columnName]['gui_type_name'];      
        guiType = this.getColumnGuiTypeForQuery(guiType);
        
        var filter = event.target.value;
        filter = DataHelper.changeDataForFilterByGuiType(guiType, filter, event.target.name, columnName, this.getLocalKey("data"));
    
        if(filter.toString().length == 0) 
        {
            delete this.params.filters[columnName];
            
            for(var i = 0; i < this.params['filterColumnNames'].length; i++)
                if(this.params['filterColumnNames'][i] == columnName)
                {
                    this.params['filterColumnNames'].splice(i, 1);
                    break;
                }
            return true;
        }

        this.params.filters[columnName] = 
        {
            type: filterType,
            guiType: guiType,
            filter: filter,
            description: ""
        };
        
        this.params.filters[columnName]['description'] = this.getFilterDescription(columnName);

        return true;
    }
    
    getRecordRowClass(index, record)
    {
        var cls = "odd operations";
        for(var i = 0; i < this.selectedRecordList.length; i++)
            if(index == this.selectedRecordList[i].index)
            {
                cls += " selected-row";
                break;
            }
            
        var control = this.can('isRecordDataTransportTarget', record);
        if(control) cls += " data-transport ";
        
        return cls;
    }
    
    getEditTdClass(record, columnName, typeName)
    {
        if(typeName == 'boolean:fastchange') return "";
        
        var notEditableColumns = ['id', 'created_at', 'updated_at', 'own_id', 'user_id'];
        if(notEditableColumns.includes(columnName)) return "";

        if(!this.can('edit', record)) return "";
        
        return 'edit-td';
    }
    
    getColumnType(data, columnName)
    {
        if(typeof data['columns'][columnName] == "undefined") return "default";
        
        var guiType = data['columns'][columnName]['gui_type_name'];
        var relation = data['columns'][columnName]['column_table_relation_id'];
        
        if(guiType == "files") return 'file';
        else if(guiType.split(':')[0] == "jsonviewer") return 'jsonviewer';
        else if(guiType == 'boolean:fastchange') return 'boolean:fastchange';
        else if(relation != null) return 'relation';
        else if(this.isGeoColumn(columnName, guiType)) return 'geo';
        else return 'default';
    }
    
    isGeoColumn(columnName, guiType)
    {
        var geoColumns = ['point', 'linestring', 'polygon', 'multipoint', 'multilinestring', 'multipolygon'];
        return geoColumns.includes(guiType);
    }
    
    convertDataForGui(record, columnName, guiTypeName)
    {
        if(typeof  record[columnName] == "undefined") return "";
        
        var data = DataHelper.convertDataForGui(record, columnName, guiTypeName);
        return this.sanitizer.bypassSecurityTrustHtml(data);
    }
    
    isImageFile(file)
    {
        if(file == null) return false;
        if(file == "") return false;

        var imgExts = ["jpg", "jpeg", "png", "gif"]
        var temp = file["big"].split('.');
        var ext = temp[temp.length-1];

        return imgExts.includes(ext.toLowerCase());
    }

    getFileIconUrl(fileUrl)
    {
        var temp = fileUrl.split('.');
        var ext = temp[temp.length-1];

        var iconBaseUrl = "assets/img/";
        
        switch(ext.toLowerCase())
        {
            default: return iconBaseUrl+"download_file.png";
        }
    }
    
    booleanFastChanged(event, record, columnName)
    {
        var val = $(event.target).prop("checked");
        
        for(var i = 0; i < this.data['records'].length; i++)
            if(this.data['records'][i]['id'] == record['id'])
            {
                this.data['records'][i][columnName] = val;
                return;
            }
    }
    
    getColumnRelationJson(data, columnName)
    {
        var relation = data['columns'][columnName]['column_table_relation_id'];
        return BaseHelper.objectToJsonStr(relation);
    }
    
    editRecodData(record, columnName)
    {
        this.inFormTableName = this.tableName;
        this.inFormColumnName = columnName;
        
        this.inFormRecordId = record.id;
        if(this.inFormRecordId < 1) return;

        var rand = Math.floor(Math.random() * 10000) + 1;
        this.inFormElementId = "ife-"+rand;
        
        setTimeout(() => 
        {
            $('#'+this.inFormElementId+'inFormModal').modal('show');
        }, 100);
    }
    
    closeModal(id)
    {
        BaseHelper.closeModal(id);
    }
    
    inFormSavedSuccess(event)
    {
        var len = this.data['records'].length;
        for(var i = 0; i < len; i++)
            if(this.inFormRecordId == this.data['records'][i]['id'])
            {
                this.data['records'][i][this.inFormColumnName] = event.in_form_data.display;
                
                var guiTypeName = this.data['columns'][this.inFormColumnName]["gui_type_name"];
                var temp = this.convertDataForGui(this.data['records'][i], this.inFormColumnName, guiTypeName);
                this.data['records'][i]['convertedDatasForGui'][this.inFormColumnName] = temp;
                
                this.data['records'][i]['json'] = "";
                this.data['records'][i]['json'] = BaseHelper.objectToJsonStr(this.data['records'][i]);
                
                break;
            }
        
        if(this.inFormColumnName == "php_code") return;
        
        this.closeModal(this.inFormElementId+'inFormModal');
    }
    
    getCollectiveInfo(data, columnName)
    {
        var nameMap = 
        {
            'sum': 'Toplam',
            'avg': 'Ortalama',
            'min': 'En az',
            'max': 'En çok',
            'count': 'Adet'
        };

        var info = data['collectiveInfos'][columnName];
        
        if(info == null) return "";
        if(info == "") return "";

        
        var html = nameMap[info['type']] + ': ';
        
        var temp = {};
        temp[columnName] = info['data'];
        var typeName = data['columns'][columnName]["gui_type_name"];
        html += DataHelper.convertDataForGui(temp, columnName, typeName);
        
        return this.sanitizer.bypassSecurityTrustHtml(html);
    }
    
    limitUpdated(limit)
    {
        this.params['page'] = 1;
        this.params['limit'] = parseInt(limit);

        this.saveParamsToLocal()
        this.dataReload();
    }

    pageUpdated(page)
    {
        if(this.data['pages'] < parseInt(page))
        {
            page = this.params['page'];
            $('#largePageSize').val(page);
            return;
        }
         
        this.params['page'] = parseInt(page);

        this.saveParamsToLocal();
        this.dataReload();
    }

    prevPage()
    {
        this.pageUpdated(this.params.page-1);
    }

    nextPage()
    {
        this.pageUpdated(this.params.page+1);
    }
    
    restore(record)
    {
        this.messageHelper.swalConfirm("Kayıt geri yüklenecek", record.id + " id 'li kaydı geri yüklemek istediğinize emin misiniz?", "warning")
        .then((r) =>
        {
            if(r != true) return;
            this.restoreRecord(record);
        })
    }

    restoreRecord(record)
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "tables/"+this.tableName+"/"+record.id+"/restore";
        
        this.sessionHelper.doHttpRequest("POST", url)
        .then((data) => this.restoreSuccess(data));
    }

    restoreSuccess(data)
    {
        if(data['message'] != 'success')
        {
            this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
            return;
        }
        
        this.messageHelper.toastMessage("Geri yükleme başarılı", 'success');
        this.generalHelper.navigate('table/'+this.tableName);
    }
    
    getOpperationLink(operation, record)
    {
        return operation['link'].replace("[id]", record['id']);
    }
    
    doOperation(policyType, record)
    {
        switch(policyType)
        {
            case 'show': this.show(record); break;
            case 'delete': this.delete(record); break;
            case 'clone': this.clone(record); break;
            case 'edit': this.edit(record); break;
            case 'archive': this.archive(record); break;
            case 'export': this.export(record); break;
            default: console.log("doOperation ("+policyType + ": " + record.id+")");
        }
    }

    navigate(subPage)
    {
        this.generalHelper.navigate("table/"+this.tableName+"/"+subPage);
    }

    show(record)
    {
        this.generalHelper.navigate("table/"+this.tableName+"/"+record.id)
    }
    
    export(record)
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        this.generalHelper.navigate(url+"tables/"+this.tableName+"/"+record.id+"/export");
        //window.open(this.sessionHelper.getBackendUrlWithToken()+"tables/"+this.tableName+"/"+record.id+"/export");
    }

    archive(record)
    {
        this.generalHelper.navigate("table/"+this.tableName+"/"+record.id+"/archive")
    }
    
    edit(record)
    {
        if(BaseHelper['pipe']['ctrlKey']) return;
        this.generalHelper.navigate("table/"+this.tableName+"/"+record.id+"/edit")
    }

    editOrShow(record)
    {
        if(BaseHelper['pipe']['ctrlKey']) return;
        
        try
        {
            var temp = BaseHelper.loggedInUserInfo.auths['tables'][this.tableName]["edits"][0];
            if(typeof temp != "undefined")
            {
                this.generalHelper.navigate("table/"+this.tableName+"/"+record.id+"/edit");
                return;
            }
        }
        catch(e) {}
        
        try
        {
            var temp = BaseHelper.loggedInUserInfo.auths['tables'][this.tableName]["shows"][0];
            if(typeof temp != "undefined")
            {
                this.generalHelper.navigate("table/"+this.tableName+"/"+record.id);
                return;
            }
        }
        catch(e) {}
    }
    
    clone(record)
    {
        this.messageHelper.swalConfirm("Emin misiniz?", "Bu kaydı klonlamak istediğinize emin misiniz?", "warning")
        .then(async (r) =>
        {
            if(r != true) return;

            this.cloneConfirmed(record);
        });
    }

    cloneConfirmed(record)
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "tables/"+this.tableName+"/"+record.id+"/clone";
        
        this.sessionHelper.doHttpRequest("POST", url)
        .then((data) => this.cloneSuccess(data));
    }

    cloneSuccess(data)
    {
        if(data['message'] != 'success')
        {
            if(typeof data['message'] == "undefined")
                this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
            else if(data['message'] == 'error')
            {
                var list = '';
                var keys = Object.keys(data['errors']);
                for(var i = 0; i < keys.length; i++)
                    for(var j = 0; j < data['errors'][keys[i]].length; j++)
                        list += ' - '+data['errors'][keys[i]][j] + '<br>';

                this.messageHelper.sweetAlert("Klon esnasında bazı hatalar oluştu!<br><br>"+(list), "Hata", "warning");
            }
            else
                this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
                
            return;
        }
                
        var id = data['id'];
        
        this.messageHelper.toastMessage("Klonlama başarılı", 'success');
        
        this.params.filters =
        {
            'id': 
            {
                'type': 1,
                'guiType': 'numeric',
                'filter': id
            }
        };
        
        this.params['filterColumnNames'] =['id'];
        
        this.saveParamsToLocal();
        
        this.dataReload();
    }
    
    delete(record)
    {
        var title = "Kayıt silinecek";
        var message = record.id + " id 'li kaydı simek istediğinize emin misiniz?";

        if(this.selectedRecordList.length > 1)
        {
            title = this.selectedRecordList.length+" kayıt silinecek";
            var message = "";
            for(var i = 0; i < this.selectedRecordList.length; i++)
                message += this.selectedRecordList[i].id + ", ";
            
            message = message.substr(0, message.length -2);
            message += " id 'li kayıtları simek istediğinize emin misiniz?";
        }

        this.messageHelper.swalConfirm(title, message, "warning")
        .then(async (r) =>
        {
            if(r != true) return;

            if(this.selectedRecordList.length <= 1)
            {
                this.deleteRecord(record);
                return;
            }

            for(var i = 0; i < this.selectedRecordList.length; i++)
            {
                this.deleteRecord(this.selectedRecordList[i]);
            }
            this.selectedRecordList = [];
            this.selectedRecord = null;
        });
    }

    deleteRecord(record)
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "tables/"+this.tableName+"/"+record.id+"/delete";
        
        this.sessionHelper.doHttpRequest("POST", url)
        .then((data) => 
        {
            if(typeof data['message'] == "undefined")
                this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
            else if(data['message'] == 'success')
                this.deleteSuccess(record);
            else
                this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
        });
    }

    deleteSuccess(record)
    {
        this.messageHelper.toastMessage("Silme başarılı", 'success');
        
        var recs = this.data['records'];

        for(var i = 0; i < recs.length; i++)
            if(recs[i]['id'] == record['id'])
            {
                this.data['records'].splice(i, 1);
                delete this.data['collectiveInfos'];
                
                for(var j = 0 ; j < this.data['columnNames'].length; j++)
                {
                    var columnName = this.data['columnNames'][j];
                    this.data['collectiveInfosHtml'][columnName] = "";
                }
                
                return;
            }
    }
    
    selectRecord(event, record, i)
    {
        if(BaseHelper["pipe"]["altKey"]) return true;

        event.preventDefault();
        record.index = i;

        if(this.selectedRecord == null)
        {
            this.selectedRecord = record;
            this.selectedRecordList = [record];
        }
        else if(this.selectedRecord.index == record.index)
        {
            this.selectedRecord = null;
            this.selectedRecordList = [];
        }
        else if(BaseHelper['pipe']['shiftKey'])
        {
            var records = this.data['records'];
            this.selectedRecordList = [];

            var start = this.selectedRecord.index;
            var end = i;

            if(start > i)
            {
                var temp = end;
                end = start;
                start = temp;
            }

            for(var j = 0; j < records.length; j++)
                if(j >= start && j <= end)
                {
                    records[j].index = j;
                    this.selectedRecordList.push(records[j]);
                }
        }
        else if(BaseHelper['pipe']['ctrlKey'])
        {
            this.selectedRecordList.push(record);   
        }
        else
        {
            this.selectedRecord = record;
            this.selectedRecordList = [record];
        }
        
        for(var j = 0; j < this.data['records'].length; j++)
        {
            var className = this.getRecordRowClass(j, this.data['records'][j]);
            this.data['records'][j]['recordClass'] = className;
        }
        
        this.clearSelectionText()
    }
    
    clearSelectionText()
    {
        if (window.getSelection) {window.getSelection().removeAllRanges();}
        else if (document['selection']) {document['selection'].empty();}
    }
    
    canUserImitation(user)
    {
        if(this.tableName != 'users') return false;

        if(BaseHelper['loggedInUserInfo']['user']['id'] == user['id']) return false;

        return this.canAdminAuth('userImitation');
    }
    
    canMissionTrigger(record)
    {
        if(this.tableName != 'missions') return false;
        
        if(typeof BaseHelper['loggedInUserInfo']['auths']['missions'] == "undefined") return false;
        if(typeof BaseHelper['loggedInUserInfo']['auths']['missions'][record['id']] == "undefined") return false;
        
        return true;
    }
    
    canDataEntegrator()
    {
        if(this.tableName != 'tables') return false;

        return this.canAdminAuth('dataEntegrator'); 
    }

    canAuthWizard()
    {
        if(this.tableName != 'tables') return false;

        return this.canAdminAuth('authWizard'); 
    }
    
    canSelectUpTable()
    {
        return this.data['table_info']['up_table']; 
    }

    canAdminAuth(auth)
    {
        if(typeof BaseHelper['loggedInUserInfo']['auths']['admin'] == 'undefined') return false;
        if(typeof BaseHelper['loggedInUserInfo']['auths']['admin'][auth] == 'undefined') return false;
        
        return true;
    }
    
    userImitation(user)
    {
        this.sessionHelper.userImitation(user);
    }
    
    missionTriggerConfirm(record)
    {
        this.messageHelper.swalPrompt('Tetikleme görevi için veri girmek ister misiniz?')
        .then(async (data) =>
        {
            if(typeof data["dismiss"] != "undefined") return;
            
            this.missionTrigger(record, data["value"]);
        });
        
    }
    
    missionTrigger(record, data)
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "missions/"+record['id']+"?"+data;
        
        this.sessionHelper.doHttpRequest("POST", url)
        .then((data) => 
        {
            if(typeof data['message'] == "undefined")
                this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
            else
                this.messageHelper.sweetAlert("Tetikleme cevabı: "+data['message'], "Bilgi", "info");
        })
        .catch((e) => 
        { 
            this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
        }); 
    }
    
    selectAsUpTableRecord(record)
    {
        var loggedInUserId = BaseHelper.loggedInUserInfo['user']['id'];
        var key = 'user:'+loggedInUserId+'.dataTransport';
        
        BaseHelper.writeToLocal(key, 
        {
            'tableName': this.tableName,
            'recordId' : record.id
        });
        
        for(var i = 0; i < this.data['records'].length; i++)
            this.data['records'][i]['recordClass'] = this.getRecordRowClass(i, this.data['records'][i]);
        
        this.messageHelper.toastMessage('Veri aktarılacak kayıt olarak belirlendi');
    }

    authWizard(table)
    {
        this.generalHelper.navigate('authWizard/'+table['name']+"/"+table['id']);
    }

    dataEntegrator(table)
    {
        this.generalHelper.navigate('dataEntegrator/'+table['name']+"/"+table['id']);
    }
    
    addEventForThemeIcons()
    {
        this.aeroThemeHelper.addEventForFeature("mobileMenuButton");
        this.aeroThemeHelper.addEventForFeature("rightIconToggleButton");
    }
    
    themeOperations()
    {
        this.aeroThemeHelper.addEventForFeature("standartElementEvents");
        this.aeroThemeHelper.pageRutine();  

        setTimeout(() => 
        {
            $('.filter-cell multi-select-element').parent().parent().css('padding', '5 0 0 5');
        }, 500);
        
        this.nativeOperations();
    }
    
    nativeOperations()
    {
        if(BaseHelper.isBrowser) return;
        
        setTimeout(() =>
        {
            $('#pageTitle').css('text-align', 'center');
            $('#tableOperationsRow').css('margin-right', 'auto');
            $('#tableOperationsRow').css('margin-bottom', '5px');
        }, 100);
    }
}