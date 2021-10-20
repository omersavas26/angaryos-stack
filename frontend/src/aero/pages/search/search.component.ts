import { ActivatedRoute} from '@angular/router';
import { Component } from '@angular/core';

import { SessionHelper } from './../helpers/session';
import { BaseHelper } from './../helpers/base';
import { DataHelper } from './../helpers/data';
import { GeneralHelper } from './../helpers/general';
import { MessageHelper } from './../helpers/message';
import { AeroThemeHelper } from './../helpers/aero.theme';

declare var $: any;

@Component(
{
    selector: 'search',
    styleUrls: ['./search.component.scss'],
    templateUrl: './search.component.html'
})
export class SearchComponent 
{
    public words = "";
    public page = 1;
    public info = null;
    public results = {};
    public summary = {};
    public tableList = [];
    public filteredTableList = [];
    public disabledTables = [];
    public searching = false;
    
    constructor(
        public route: ActivatedRoute,
        public sessionHelper: SessionHelper,
        public generalHelper: GeneralHelper,
        public aeroThemeHelper: AeroThemeHelper,
        public messageHelper: MessageHelper
        ) 
    {
        var th = this;
        route.params.subscribe(val => 
        {
            th.words = val.words;

            th.showTableList();

            this.aeroThemeHelper.addEventForFeature("standartElementEvents");
            
            this.aeroThemeHelper.pageRutine();
        });

        setTimeout(() => 
        {
            this.aeroThemeHelper.addEventForFeature("layoutCommonEvents");
        }, 100);
    }

    dataControlForThisPage(tableName)
    {
        if(this.page > 1 && typeof this.results[tableName] == "undefined")
            return false;
        
        if(typeof this.results[tableName] != "undefined")
            if(this.page > this.results[tableName][1]['pages'])
                return false;

        return true;
    }

    nullTableAuth()
    {
        this.messageHelper.sweetAlert("Arama yapmak için bir hiç bir tablo yetkiniz yok!", "Hata", "error");
    }
    
    async showTableList()
    {
        $('#search').click();
        
        if(this.tableList.length > 0)
        {
            setTimeout(() => 
            {
                $('#tableListModal').modal("show");
            }, 500);
            return;
        }
                
        var info = BaseHelper.loggedInUserInfo;
        if(info == null) return this.nullTableAuth();

        if(typeof info["auths"] == "undefined") return this.nullTableAuth();
        if(typeof info["auths"]["tables"] == "undefined") return this.nullTableAuth();

        this.info = info;

        var tables = info["auths"]["tables"];
        var tableNames = Object.keys(tables);
        
        for(var i = 0; i < tableNames.length; i++)
        {
            if(!this.dataControlForThisPage(tableNames[i])) 
            {
                this.generalHelper.stopLoading();
                continue;
            }

            var rec = {
                name: tableNames[i],
                displayName: tables[tableNames[i]]["display_name"],
                selected: true
            };
            
            this.tableList.push(rec);
        }

        this.filteredTableList = BaseHelper.getCloneFromObject(this.tableList);
        
        setTimeout(() => 
        {
            $('#tableListModal').modal("show");
        }, 500);
    } 
    
    toggleTableSelected(table)
    {
        table["selected"] = !table["selected"];
        this.syncTableListFromFilteredTableList();
    }

    syncTableListFromFilteredTableList()
    {
        for(var i = 0; i < this.filteredTableList.length; i++)
            for(var j = 0; j < this.tableList.length; j++)
                if(this.filteredTableList[i]["name"] == this.tableList[j]["name"])
                {
                    this.tableList[j]["selected"] = this.filteredTableList[i]["selected"];
                    break;
                }
    }    

    selectAllTables()
    {
        for(var i = 0; i < this.filteredTableList.length; i++)
            this.filteredTableList[i]["selected"] = true;
        
        
        this.syncTableListFromFilteredTableList();
    }
    
    unselectAllTables()
    {
        for(var i = 0; i < this.filteredTableList.length; i++)
            this.filteredTableList[i]["selected"] = false;

        this.syncTableListFromFilteredTableList();
    }
    
    async searchInSelectedTables(force)
    {
        var info = BaseHelper.loggedInUserInfo;
        if(info == null) return this.nullTableAuth();
       
        if(typeof info["auths"] == "undefined") return this.nullTableAuth();
        if(typeof info["auths"]["tables"] == "undefined") return this.nullTableAuth();

        this.info = info;
        var tables = info["auths"]["tables"];
        
        this.searching = true;
        if(force) this.disabledTables = [];
        
        for(var i = 0; i < this.tableList.length; i++)
        {
            try 
            {
                if(!this.tableList[i]["selected"]) continue;

                var name = this.tableList[i]["name"];
                if(this.disabledTables.includes(name)) continue;                                        
                
                this.generalHelper.startLoading();
                await this.searchOnTable(name, tables[name]);                    
                this.generalHelper.stopLoading(); 
                
                if(!this.searching) break;                   
                await BaseHelper.sleep(800);   
            }
            catch (error) 
            {
                this.generalHelper.stopLoading();
                this.messageHelper.toastMessage("Bazı hatalar oluştu. Tüm sonuçlar görüntülenmiyor olabilir"); 
                console.log(error);
            }
        }
        
        this.searching = false;     
    }

    async searchOnTable(tableName, table)
    {
        $('#tableListModal').click();

        if(typeof this.results[tableName] != "undefined") 
            if(typeof this.results[tableName][this.page] != "undefined") 
            {
                setTimeout(() => 
                {
                    this.aeroThemeHelper.pageRutine();
                }, 500);
                return;
            }
        
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "search/"+tableName+"/"+encodeURI(this.words);
        
        var th = this;

        var listId = table['lists'][0];
        var queryId = listId;
        
        try
        {
            queryId = table['queries'][0];
        }
        catch(e) {}
        
        await this.sessionHelper.doHttpRequest("POST", url, 
        {
            'column_array_id': listId,
            'column_array_id_query': queryId,
            'page': th.page
        })
        .then((data) => 
        {
            if(data['records'].length == 0)
            {
                this.disabledTables.push(tableName);
                return;
            }

            if(data['pages'] == this.page)
                this.disabledTables.push(tableName);

            if(typeof th.results[tableName] == "undefined")  th.results[tableName] = [];
            th.results[tableName][th.page] = data;

            setTimeout(() => 
            {
                this.aeroThemeHelper.pageRutine();
            }, 500);
        })
    }

    search()
    {
        var words = $('#searchInput').val();
        
        if(words == null || words.length == 0)
        {
            this.messageHelper.toastMessage("Aramak için birşeyler yazmalısınız!");
            return;
        }
        
        if(words.trim() == this.words.trim())
        {
            this.messageHelper.swalConfirm("Arama", "Aynı kelimeler ile tekrar arama yapmak istediğinize emin misiniz?", "info")
            .then((r) =>
            {
                if(r != true) return;
                
                this.showTableList();
            });            
            return;
        }
        
        this.words = words.trim();
        this.showTableList();
    }

    getTableNames()
    {
        if(this.results == null) return [];

        return Object.keys(this.results);
    }

    getRecords(tableName)
    {
        if(typeof this.results[tableName][this.page] == "undefined") return [];

        return this.results[tableName][this.page]['records'];
    }

    showInfoPage(tableName, record)
    {
        this.generalHelper.navigate("table/"+tableName+"/"+record['id']);
    }

    getInfoPageURL(tableName, record)
    {
        //return BaseHelper.baseUrl+"table/"+tableName+"/"+record['id'];
        return "table/"+tableName+"/"+record['id'];
    }

    getTableDisplayName(tableName)
    {
        if(typeof this.results[tableName] == "undefined")
            return tableName;

        return this.results[tableName][1]['table_info']['display_name'];
    }

    getRecordSummary(tableName, recordIndex)
    {
        var data = this.results[tableName][this.page];
        var record = data['records'][recordIndex];

        var key = tableName+"_"+record['id'];
        if(typeof this.summary[key] != "undefined") return this.summary[key];

        var exc = ["point", "multipoint", "linestring", "multilinestring", "polygon", "multipolygon", "files"];

        var summary = "";
        var columnNames = Object.keys(data['columns']);
        for(var i = 0; i < columnNames.length; i++)
        {
            var type = data['columns'][columnNames[i]]['gui_type_name'];
            if(exc.includes(type)) continue;

            var displayName = data['columns'][columnNames[i]]['display_name'];

            summary += displayName + ": ";
            summary += this.convertDataForGui(record, columnNames[i], type);
            summary += ",&nbsp&nbsp&nbsp";
        }
        
        this.summary[key] = summary;
        return this.summary[key];
    }

    convertDataForGui(record, columnName, type)
    {
        var data = DataHelper.convertDataForGui(record, columnName, type);
        return data;
    }

    getMaxPage()
    {
        if(this.results == null) return 0;

        var max = 0;

        var tableNames = Object.keys(this.results);
        for(var i = 0; i < tableNames.length; i++)
            if(max < this.results[tableNames[i]][1]['pages'])
                max = this.results[tableNames[i]][1]['pages'];

        return max;
    }

    getPageRange()
    {
        var r = [];
        for(var i = 1; i <= this.getMaxPage(); i++) r.push(i);
        return r;
    }

    setPage(page)
    {
        this.page = page;
        this.searchInSelectedTables(false);
    }

    tableSearch()
    {
        var word = $('#tableSearchInput').val();
        if(word == null || word.length == 0) this.filteredTableList = BaseHelper.getCloneFromObject(this.tableList);

        this.filteredTableList = [];
        word = word.toLocaleLowerCase();
        for(var j = 0; j < this.tableList.length; j++)
        {
            var t = this.tableList[j];

            if(t["name"].toLocaleLowerCase().indexOf(word) > -1 || t["displayName"].toLocaleLowerCase().indexOf(word) > -1)
            
            this.filteredTableList.push(BaseHelper.getCloneFromObject(t));
        }
    }
}
