import { Injectable } from '@angular/core';
import { BaseHelper } from './base';
import { SessionHelper } from './session';

declare var $: any;

@Injectable()
export class AeroThemeHelper 
{     
    public baseMenu = [];
    
    constructor(private sessionHelper: SessionHelper) { }



    /****    GUI Features Functions    ****/
    
    public pageRutine()
    {
        setTimeout(() =>
        {
            var control = window.location.href.indexOf('#/'+BaseHelper.angaryosUrlPath+'/') > -1;
            if(control)
            {
              setTimeout(() => 
              {
                $(".page-loader-wrapper").fadeOut(200);
              }, 1000);
            }
            else $(".page-loader-wrapper").fadeOut();  
            
            $('span.select2-results').parent().remove();

            $('.tooltip-inner').remove();
            $('[data-toggle="tooltip"]').tooltip();
            
            $.ajax({
                type: "GET",
                url: 'assets/themes/aero/assets/bundles/libscripts.bundle.js',
                success: {},
                dataType: "script",
                cache: true
            }); 
            
            if($('section.content').length > 0 && (BaseHelper.isAndroid || BaseHelper.isIos))
            {
              var h = $('.body_scroll .card').height();
              if(typeof h == "undefined") h = window.innerHeight * 0.9;
              else h += 125;
              $('div#target-container-fluid').css('height', (h*0.85)+"px");
              $('section.content:eq(0)').css('height', (h*0.95)+"px");
              $('section.content:eq(0)').css('overflow', 'hidden');
              $('section.content:eq(0)').css('overflow', 'auto');
            }
        }, 100);

        if($('section.content').length > 0 && (BaseHelper.isAndroid || BaseHelper.isIos))
        {
          var h = $('.body_scroll').height() || $('.body_scroll .card').height()
          if(typeof h == "undefined") h = window.innerHeight - 70;
          else h += 100;

          $('div#target-container-fluid').css('height', (h)+"px");
          $('section.content:eq(0)').css('height', (h)+"px");
          $('section.content:eq(0)').css('overflow', 'hidden');
          $('section.content:eq(0)').css('overflow', 'auto');
        }
    }

    public loadPageScripts()
    {
      if(BaseHelper.readFromPipe('loadPageScriptsLoaded'))  return;
      
      BaseHelper.writeToPipe('loadPageScriptsLoaded', true);
      BaseHelper.writeToPipe('loadPageScriptsLightLoaded', true);
      
      setTimeout(async () => 
      {
        await BaseHelper.getScript('https://cdnjs.cloudflare.com/ajax/libs/jQuery-slimScroll/1.3.8/jquery.slimscroll.min.js');
        
        BaseHelper.getScript('assets/themes/aero/assets/bundles/libscripts.bundle.js', function()
        {
          BaseHelper.getScript('assets/themes/aero/assets/bundles/vendorscripts.bundle.js', function()
          {
            BaseHelper.getScript('assets/themes/aero/assets/bundles/mainscripts.bundle.js');
            BaseHelper.getScript('assets/themes/aero/assets/plugins/jquery-inputmask/jquery.inputmask.bundle.js');

            
            BaseHelper.getScript('assets/themes/aero/assets/bundles/jvectormap.bundle.js');
            BaseHelper.getScript('assets/themes/aero/assets/bundles/sparkline.bundle.js');
            BaseHelper.getScript('assets/themes/aero/assets/bundles/c3.bundle.js');

            BaseHelper.getScript('assets/themes/aero/assets/plugins/jquery-validation/jquery.validate.js');
            BaseHelper.getScript('assets/themes/aero/assets/plugins/jquery-steps/jquery.steps.js');
          });     

          BaseHelper.getScript('assets/ext_modules/ace-builds/src-min/ace.js', function()
          {
            BaseHelper.getScript('assets/ext_modules/ace-builds/src-min/mode-php.js');
            BaseHelper.getScript('assets/ext_modules/ace-builds/src-min/mode-sql.js');
            BaseHelper.getScript('assets/ext_modules/ace-builds/src-min/mode-javascript.js');
            BaseHelper.getScript('assets/ext_modules/ace-builds/src-min/theme-twilight.js');
            BaseHelper.getScript('assets/ext_modules/ace-builds/src-min/theme-github.js');
          });
        });

        BaseHelper.getScript('assets/ext_modules/select2/select2.min.js');
        
        BaseHelper.getScript('assets/ext_modules/jsonTreeViewer/libs/jsonTree/jsonTree.js');
        BaseHelper.getScript('assets/ext_modules/slimscrool/jquery.slimscroll.min.js');
      }, 10);
    }

    public loadPageScriptsLight()
    {
      if(BaseHelper.readFromPipe('loadPageScriptsLightLoaded'))  return;
      
      BaseHelper.writeToPipe('loadPageScriptsLightLoaded', true);
      
      setTimeout(() => 
      {
        BaseHelper.getScript('assets/themes/aero/assets/bundles/libscripts.bundle.js', function()
        {
          BaseHelper.getScript('assets/themes/aero/assets/bundles/vendorscripts.bundle.js');
        });
      }, 10);
    }
    
    public async addEventForFeature(name)
    {
        await BaseHelper.sleep(500);

        switch (name) 
        {
            case 'leftSideBar': return this.addLeftSideBarEvents();
            case 'mobileMenuButton': return this.addMobileMenuButtonEvents();
            case 'rightIconToggleButton': return this.addRightIconToggleButtonEvents();
            case 'standartElementEvents': return this.addStandartElementEvents();

            case 'layoutCommonEvents': 
                this.addMobileMenuButtonEvents();
                this.addRightIconToggleButtonEvents();
                return;

            default: return alert(name + " event bulunamadı");
        }
    }

    public removeThemeClass()
    {
      $('body').removeClass('theme-dark');
      $('body').removeClass('theme-light');
    }

    public addThemeClass()
    {
      $('body').addClass(this.getThemeClass());
    }

    public addStandartElementEvents()
    {
      this.removeThemeClass();
      this.addThemeClass();
    }

    public addMobileMenuButtonEvents()
    {
        $(".mobile_menu").on("click", function() 
        {
            $(".sidebar").toggleClass("open")
        });
    }

    public addRightIconToggleButtonEvents()
    {
        $(".right_icon_toggle_btn").on("click", function() 
        {
            $("body").toggleClass("right_icon_toggle")
        });
    }

    public addLeftSideBarEvents()
    {
      if(typeof BaseHelper.addedScripts['leftSideBar'] != "undefined") return;
      
      $.each($(".menu-toggle.toggled"), function(a, b) 
      {
          $(b).next().slideToggle(0)
      });

      $(".menu-toggle").on("click", function(a) 
      {
          var b = $(this),
              c = b.next();

          if ($(b.parents("ul")[0]).hasClass("list")) 
          {
              var d = $(a.target).hasClass("menu-toggle") ? a.target : $(a.target).parents(".menu-toggle");
              $.each($(".menu-toggle.toggled").not(d).next(), function(a, b) {
                  $(b).is(":visible") && ($(b).prev().toggleClass("toggled"), $(b).slideUp())
              })
          }
          b.toggleClass("toggled"), c.slideToggle(320)
      });

      BaseHelper.addedScripts['leftSideBar'] = true;
    }



    /****    Current Theme Functions    ****/
    
    public getThemeClass()
    {
      var theme = 'theme-light';

      var name = this.getTheme();
      if(typeof name != "undefined" && name != null && name.length > 0)
        theme = 'theme-'+name;
      
      return theme
    }

    public setTheme(name)
    {
      BaseHelper.writeToLocal('theme', name);
    }

    public getTheme()
    {
      return BaseHelper.readFromLocal('theme');
    }



    /****   Base Menu Functions    ****/
    
    private controlSearchForTableItem(item, search)
    {
      if(search.length == 0) return true;

      search = search.toLocaleLowerCase();

      if(item.display_name.toLocaleLowerCase().indexOf(search) > -1) return true;
      if(item.name.toLocaleLowerCase().indexOf(search) > -1) return true;

      return false;
    }
    
    private controlSearchForAdditionalLinkItem(item, search)
    {
      if(search.length == 0) return true;

      search = search.toLocaleLowerCase();

      if(item.name_basic.toLocaleLowerCase().indexOf(search) > -1) return true;

      return false;
    }

    private getTableGroupdById(id)
    {
      var tableGroups = BaseHelper.loggedInUserInfo.menu.tableGroups;
      for (let i = 0; i < tableGroups.length; i++) 
        if(tableGroups[i]['id'] == id)
          return tableGroups[i];
    }

    private getTableGroupdByIds()
    {
      var tableGroups = BaseHelper.loggedInUserInfo.menu.tableGroups;
      
      var tableGroupIds = []
      for(var i = 0; i < tableGroups.length; i++)
        tableGroupIds.push(tableGroups[i]['id']);

      return tableGroupIds;
    }

    private getTableGroupsForMenuItem(search = "")
    {
      var menu = [];

      var tables = BaseHelper.loggedInUserInfo.menu.tables;  
      
      var additionalLinks = [];
      if(typeof BaseHelper.loggedInUserInfo.menu.additionalLinks != "undefined")
        additionalLinks = BaseHelper.loggedInUserInfo.menu.additionalLinks;
              
      var tableGroupIds = this.getTableGroupdByIds();
     
      for (var i = 0; i < tableGroupIds.length; i++) 
      {
        var tableGroup = this.getTableGroupdById(tableGroupIds[i]);
        
        var tempMenuItem =
        {
          title: tableGroup['name_basic'],
          icon: tableGroup['icon'],
          toggled: search.length > 0,
          tableGroupId: tableGroupIds[i],
          children: []
        }; 

        var children = []; 
        
        if(typeof tables[tableGroupIds[i]] != "undefined")
        {
            var tempTables = tables[tableGroupIds[i]];
            for(var j = 0; j < tempTables.length; j++)
            {
              if(!this.controlSearchForTableItem(tempTables[j], search)) continue;

              var temp = 
              {
                type: 'standart',
                title: tempTables[j].display_name,
                linkDescription: tempTables[j].link_description,
                link: '/'+BaseHelper.angaryosUrlPath+'/table/'+tempTables[j].name
              };

              children.push(temp);
            }
        }
        
        for(var k = 0; k < additionalLinks.length; k++)
        {
            var additionalLink = additionalLinks[k];
            if(additionalLink.table_group_id == null) additionalLink.table_group_id = 0;
            
            if(additionalLink.table_group_id != tableGroupIds[i]) continue;
            if(!this.controlSearchForAdditionalLinkItem(additionalLink, search)) continue;

            var temp2 = 
            {
              type: 'additionalLink',
              title: additionalLink['name_basic'],
              linkDescription: additionalLink['link_description'],
              additionalLink: additionalLink,
              tableGroupId: additionalLink['table_group_id']
            };

            children.push(temp2);
        }

        if(children.length == 0) continue;

        tempMenuItem.children = children.sort(function(a, b) 
        { 
          if(a.title == null) a.title = a.link;
          if(b.title == null) b.title = b.link;

          return a.title.localeCompare(b.title);
        });
        
        menu.push(tempMenuItem);
      }

      return menu;
    }

    public getHomePageMenuItem()
    {
      var homePage =
      {
        title: 'Panel Anasayfa',
        icon: 'zmdi-home',
        link: '/'+BaseHelper.angaryosUrlPath+'/home',
      };
      return homePage;
    }

    public getDashboardPageMenuItem()
    {
      var page =
      {
        title: 'Göstergeler',
        icon: 'zmdi-copy',
        link: '/'+BaseHelper.angaryosUrlPath+'/dashboard',
      };
      return page;
    }

    public getMapPageMenuItem()
    {
      var mapPage =
      {
        title: 'Harita',
        icon: 'zmdi-map',
        link: '/'+BaseHelper.angaryosUrlPath+'/map',
      };
      return mapPage;
    }
    
    public getRecordImportPageMenuItem()
    {
      var mapPage =
      {
        title: 'İçe Aktar',
        icon: 'zmdi-sign-in',
        link: '',
        func: 'importRecord',
      };
      return mapPage;
    }
    
    public getLogsPageMenuItem()
    {
      var mapPage =
      {
        title: 'Sunucu Logları',
        icon: 'zmdi-code-setting',
        link: '',
        func: 'openBackendLogs',
      };
      return mapPage;
    }
    
    public updateBaseMenu(search = "")
    {
      this.baseMenu =  [ ];

      if(search == "")
      {
        this.baseMenu.push(this.getHomePageMenuItem());
        
        if(this.sessionHelper.mapAuthControl())
          this.baseMenu.push(this.getMapPageMenuItem());
          
        if(this.sessionHelper.recordImportAuthControl())
          this.baseMenu.push(this.getRecordImportPageMenuItem());
          
        if(this.sessionHelper.debugUserAuthControl())
          this.baseMenu.push(this.getLogsPageMenuItem());
        
        this.baseMenu.push(this.getDashboardPageMenuItem());
      }

      var tableGroups = this.getTableGroupsForMenuItem(search);
      for (let i = 0; i < tableGroups.length; i++) 
        this.baseMenu.push(tableGroups[i]);
      
      setTimeout(() => 
      {
        delete BaseHelper.addedScripts['leftSideBar'];
        this.addEventForFeature("leftSideBar");
      }, 100);
    }
}