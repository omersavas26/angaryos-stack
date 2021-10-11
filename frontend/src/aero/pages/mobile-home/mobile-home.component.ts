import { ActivatedRoute} from '@angular/router';
import { Component } from '@angular/core';

import { environment } from './../../../environments/environment';

import { SessionHelper } from './../helpers/session';
import { BaseHelper } from './../helpers/base';
import { GeneralHelper } from './../helpers/general';
import { MessageHelper } from './../helpers/message';
import { AeroThemeHelper } from './../helpers/aero.theme';

declare var $: any;

@Component(
{
    selector: 'mobile-home',
    styleUrls: ['./mobile-home.component.scss'],
    templateUrl: './mobile-home.component.html',
})
export class MobileHomeComponent 
{
    news = [];
    
    constructor(
        private route: ActivatedRoute,
        private sessionHelper: SessionHelper,
        private generalHelper: GeneralHelper,
        private aeroThemeHelper: AeroThemeHelper,
        private messageHelper: MessageHelper
        )
    {
        if(BaseHelper.isBrowser) 
        {
            this.generalHelper.navigate('/login');
            return;
        }
        
        this.fillNews();
    }
    
    fillNews()
    {
        if(this.fillNewsFromPipe()) return;
        if(this.fillNewsFromLocal()) return;
        if(this.fillNewsFromServer()) return;
        
        setTimeout(() => this.messageHelper.sweetAlert("Sunucudan haberler alınırken bir hata oluştu! Lütfen daha sonra tekrar deneyin.", "Hata", "warning"), 1000);       
    }
    
    fillNewsFromPipe()
    {        
        if(typeof BaseHelper.pipe['newsForMobileHome'] == "undefined") return false;
        
        this.news = BaseHelper.pipe['newsForMobileHome'];
        setTimeout(() =>
        {
            this.aeroThemeHelper.pageRutine();
        }, 500);
        return true;
    }
    
    fillNewsFromLocal()
    {        
        var temp = BaseHelper.readFromLocal("newsForMobileHome");
        if(temp == null) return false;
        
        this.news = temp;
        BaseHelper.pipe['newsForMobileHome'] = this.news;
        setTimeout(() =>
        {
            this.aeroThemeHelper.pageRutine();
        }, 500);
        return true;
    }
    
    fillNewsFromServer()
    {        
        setTimeout(() =>
        {
            var params = {
                "page":1,
                "limit":"10",
                "column_array_id":"0",
                "column_array_id_query":"0",
                "sorts": {
                    "id": false
                },
                "filters":{
                    "state": {
                        "type": 1,
                        "guiType": "boolean",
                        "filter": true
                    }
                }
            };

            var url = BaseHelper.backendUrl+"public/tables/public_contents";

            this.sessionHelper.doHttpRequest("POST", url, {'params': BaseHelper.objectToJsonStr(params)})
            .then((data) => 
            {
                this.news = this.formatNews(data['records']);
                
                BaseHelper.writeToLocal("newsForMobileHome", this.news, 1000*60*60);
                BaseHelper.pipe['newsForMobileHome'] = this.news;
                
                setTimeout(() =>
                {
                    this.aeroThemeHelper.pageRutine();
                }, 500);
            })
            .catch((e) =>
            {
                if(e == '***') return;
                
                console.log(e);
                this.messageHelper.sweetAlert("Sunucudan haberler alınırken bir hata oluştu! Lütfen daha sonra tekrar deneyin.", "Hata", "warning");
            });
        }, 1200);
        
        return true;
    }
    
    navigate(page)
    {
        this.generalHelper.navigate(page);
    }
    
    formatNews(news)
    {        
        var formatted = [];
        
        for(var i = 0; i < news.length; i++)
        {
            var item = news[i];
            
            item['created_at'] = BaseHelper.dBDateTimeStringToHumanDateTimeString(item['created_at']);
            item['created_at'] = item['created_at'].substr(0, 16);
            
            if(typeof item['images'] == "undefined") item['images'] = "[]";
            if(item['images'] == null) item['images'] = "[]";
            item['images'] = BaseHelper.jsonStrToObject(item['images']);
            
            for(var j = 0; j < item['images'].length; j++)
            {
                item['images'][j]['mUrl'] = BaseHelper.getFileUrl(item['images'][j], 'm_');
            }            
            if(item['images'].length == 0) item['images'] = [{"mUrl": BaseHelper.noImageUrl}];
            
            item['summary'] = item['summary'].substr(0, 200)+"...";
            
            formatted.push(item);
        }
        
        return formatted;
    }
    
    detail(item)
    {
        this.generalHelper.navigate('/mobile-home-detail/'+item['id']);
    }
}