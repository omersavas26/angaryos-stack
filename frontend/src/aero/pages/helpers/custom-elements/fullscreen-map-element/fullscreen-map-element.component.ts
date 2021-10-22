import { Component, EventEmitter, Input, Output } from '@angular/core';
import { intersect as turfIntersect, polygon as turfPolygon } from '@turf/turf';

import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

import { WKT, GeoJSON} from 'ol/format';

import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';

import { BaseHelper } from './../../base';
import { AeroThemeHelper } from './../../aero.theme';
import { MapHelper } from './../../map';
import { MessageHelper } from './../../message';
import { SessionHelper } from './../../session';
import { GeneralHelper } from './../../general';

declare var $: any;

@Component(
{
    selector: 'fullscreen-map-element',
    styleUrls: ['./fullscreen-map-element.component.scss'],
    templateUrl: './fullscreen-map-element.component.html'
})
export class FullScreenMapElementComponent
{
    @Input() token: string = "public";
    @Input() loggedInUserInfoJson: string = "";
    
    @Output() changed = new EventEmitter();

    layers = [];
    layerFilterString = ""
    
    inFormColumnName = "";
    inFormTableName = "";
    inFormRecordId = 0;
    inFormElementId = "";
    inFormTargetData = {};
    inFormSelectDataForColumn = [];

    map = null;
    loggedInUserInfo = null;
    layerList = [];
    toolsBarVisible = true;
    featuresTreeVisible = false;
    vectorFeaturesTree = {};
    mapClickMode = "getClickedFeatureInfo";
    waitDrawSingleFeature = false;
    drawingInteraction = null;
    ctrlPressed = false;
    altPressed = false;
    selectAreaStartPixel = null;
    tableGeoColumns = {};
    tableColumns = {};
    
    featureList = {};
    lastSelectedFeatureData = {};
    
    legendUrl = '';
    showLegendPanel = false;
    
    //loading = false;
    searching = false;
    
    typesMatch = 
    {
        point: 'Nokta',
        linestring: 'Çizgi',
        polygon: 'Alan'
    };

    /****    Default Functions     ****/

    constructor(
        private messageHelper: MessageHelper,
        private aeroThemeHelper: AeroThemeHelper,
        private sessionHelper: SessionHelper,
        private generalHelper: GeneralHelper) 
    {
        window.onhashchange = ((e) => this.urlChanged(e));
    }

    ngAfterViewInit() 
    {  
        this.fillInFormSelectDataForColumn();
        
        setTimeout(() =>
        {
            this.aeroThemeHelper.loadPageScriptsLight();
            this.addKmzFileChangedEvent();
            
        }, 200);
    }

    ngOnChanges()
    {
        this.loggedInUserInfo = BaseHelper.jsonStrToObject(this.loggedInUserInfoJson);
        if(this.loggedInUserInfo == "") return;

        this.addKeyShortcuts();

        this.createMapElement()
        .then((map) => this.addLayers(map))
        .then((map) => this.addEvents(map))
        .then((map) => this.controlZoomTo(map))
        .then((map) => $('.ol-zoom').css('display', 'none'));

        setTimeout(() => this.layers = this.getLayers(), 100);
    }

    handleChange(event)
    {
        this.changed.emit(event);
    }  
    
    urlChanged(e)
    {
        if(e.newURL == e.oldURL) return;
        
        this.controlZoomTo(this.map);
    } 



    /****    Gui Operations    ****/
    
    /*closeModal(id)
    {
        $(id).modal('hide');
    }*/
    
    showSearchPanel()
    {
        var th = this;
        
        this.messageHelper.swalPrompt("Arama yap")
        .then((result) =>
        {
            if(typeof result['value'] == "undefined") return;
            
            th.searchWithString(result['value']);
        });
    }
    
    getSegmentsArray()
    {
        var temp = window.location.href.split('#');
        var data = temp[temp.length -1];
        var segmentsWithData = data.split('&');
        
        var segments = {};
        for(var i = 0; i < segmentsWithData.length; i++)
        {
            var dataArray = segmentsWithData[i].split('=');
            segments[dataArray[0]] = decodeURI(dataArray[1]);
        }
        
        return segments;
    }
    
    controlZoomTo(map)
    {
        var segments = this.getSegmentsArray();
        if(typeof segments['zoomTo'] == "undefined") return map;
        
        var params = BaseHelper.jsonStrToObject(segments['zoomTo']);
        
        var feature = MapHelper.getFeatureFromWkt(params['wkt'], params['srid']);
        
        this.zoomToFeature(feature);
        
        return map;
    }
    
    zoomToFeature(feature)
    {
        MapHelper.zoomToFeatures(this.map, [feature]);
    }
        
    /*startLoading()
    {
        this.generalHelper.startLoading();
    }
    
    stopLoading()
    {   
        this.generalHelper.stopLoading();
    }*/
    
    getKeys(obj)
    {
        if(obj == null) return [];
        return Object.keys(obj);
    }
    
    fillInFormSelectDataForColumn()
    {
        var temp =
        {
            "source": "length",
            "display": "Uzunluk hesapla doldur"
        };
        
        this.inFormSelectDataForColumn.push(temp);
        
        temp =
        {
            "source": "area",
            "display": "Alan hesapla doldur"
        };
        
        this.inFormSelectDataForColumn.push(temp);
    }
    
    addKmzFileChangedEvent()
    {
        var th = this;
        $('#kmzFile').change(() => th.kmzFileChanged());
    }
    
    kmzFileChanged()
    {
        var exts = ['kml', 'kmz'];

        var path = $('#kmzFile').val();
        if(path == "") return;

        var arr = path.split('.');
        var ext = arr[arr.length-1];

        if(exts.includes(ext))
            this.uploadKmz();
        else
            this.messageHelper.sweetAlert("Geçersiz doya tipi!", "Hata", "warning");
    }

    showLayersPanel()
    {
        $('#layersModal').modal('show');
    }

    getLayerAuhts(map)
    {
        var layerAuths = this.loggedInUserInfo.map;
        
        var temp = BaseHelper.readFromLocal('map.'+this.loggedInUserInfo.user.id+'.layers');
        if(temp != null) layerAuths = temp;

        return layerAuths;
    }

    setToolsBarVisible(visible)
    {
        this.toolsBarVisible = visible;
    }

    setFeaturesTreeVisible(visible)
    {
        this.featuresTreeVisible = visible;
    }

    isVectorFeaturesTreeNull()
    {
        var keys = Object.keys(this.vectorFeaturesTree);
        return keys.length == 0;
    }

    selectKmzFile()
    {
        $('#kmzFile').click();
    }
    
    addNetcadFeatures()
    {
        this.messageHelper.swalPrompt("Netcad nokta dizisi:", "Tamam", "İptal", "textarea")
        .then((data) =>
        {
            if(typeof data["value"] == "undefined") return;
            
            this.messageHelper.swalComboBox("Nesne tipi", {point: "Nokta", linestring: "Çizgi", polygon: "Alan"})
            .then((featureType) =>
            {
                var wkt = MapHelper.getWktFromNetcad(data['value'], featureType["value"]);                
                var feature = MapHelper.getFeatureFromWkt(wkt, MapHelper.userProjection);
                MapHelper.addFeatures(this.map, [feature]);
                MapHelper.zoomToFeature(this.map, feature);
                
                this.addFeatureOnVectorFeaturesTree(feature);
            });
        });
    }

    kmzAuthControl()
    {
        return this.sessionHelper.kmzAuthControl();
    }
    
    netcadAuthControl()
    {
        return true;
    }
    
    navigate(subPage)
    {
        this.generalHelper.navigate(subPage);
    }
    
    isUpTableRecordSelected()
    {
        var loggedInUserId = BaseHelper.loggedInUserInfo['user']['id'];
        var key = 'user:'+loggedInUserId+'.dataTransport';
        
        var temp = BaseHelper.readFromLocal(key);
        
        return temp != null;
    }
    
    async selectTypeAndDo(types, func)
    {
        const { value: typeName } = await Swal.fire(
        {
            title: 'Seçmek istediğiniz tip',
            input: 'select',
            inputOptions: types, 
            inputPlaceholder: 'Tip seçiniz',
            showCancelButton: false
        });

        if (typeof typeName == "undefined") return;
        if (typeName == "") return;

        func(typeName);
    }



    /****    Map Operations    ****/

    addKeyShortcuts()
    {
        var th = this;

        $(document).on('keydown', function(e)
        {
            if(!e.altKey) return;

            switch (e.key) 
            {
                case "a":
                case "A":
                    th.showSearchPanel();
                    break;
                case "k":
                case "K":
                    th.showLayersPanel();
                    break;
                case "c":
                case "C":
                    th.setToolsBarVisible(true);
                    break;
                case "n":
                case "N":
                    th.setFeaturesTreeVisible(true);
                    break;
            }
        });
    }

    createMapElement()
    {
        return new Promise((resolve) =>
        {
            BaseHelper["pipe"]["geoserverBaseUrl"] = BaseHelper.backendUrl+this.token+"/getMapData";

            var task = MapHelper.createFullScreenMap('fullScreenMap')
            .then((map) => this.map = map);

            resolve(task);
        }); 
    }

    addEvents(map)
    {
        var th = this;
        return new Promise((resolve) =>
        {
            th.addEventForClick(map);
            th.addEventForDataChanged(map);
            th.addEventForSelectArea(map);

            resolve(map);
        }); 
    }

    addEventForClick(map)
    {
        var th = this;
        map.on('click', (event) =>
        {
            //if(th.loading) return;
            
            if(th.drawingInteraction != null) 
                return;
            else if(th.featuresTreeVisible)
                return th.selectClickedFeatureOnVectorSourceTree(event);
            
            switch(th.mapClickMode)
            {
                case "getClickedFeatureInfo":
                    th.showClickedFeatureInfo(event);
                    break;
                default: console.log(th.mapClickMode)
            }
        });
    }
    
    getPolygonFromClickedPoint(coord)
    {
        var radius = MapHelper.getBufferSizeByMapZoom(this.map);
        
        var wkt = "POINT("+coord[0]+" "+coord[1]+")";
        var point = MapHelper.getFeatureFromWkt(wkt, MapHelper.mapProjection);
        var poly = MapHelper.getPolygonFromPoint(point, radius);
        
        var buffer = MapHelper.getFeatureFromGeometry(poly);
        
        MapHelper.addFeatures(this.map, [buffer]);
        setTimeout(() =>
        {
            MapHelper.deleteFeature(this.map, buffer);
        }, 1000);
        
        return buffer;
    }
    
    /*getSearchedFeatureInfoFromCustomLayer(layer, search)
    {
        return this.getSearchedFeatureInfoFromDefaultLayer(layer, search);
    }
    
    async getSearchedFeatureInfoFromDefaultLayer(layer, search)
    {
        var tableName = layer['authData']['tableName'];
        var strColumns = ['string', 'text'];
        
        var control = await this.fillTableColumns(tableName);
        if(!control) return new Promise((resolve) => resolve(null));
        
        var temp = [];
        
        var columnNames = Object.keys(this.tableColumns[tableName]);
        for(var i = 0; i < columnNames.length; i++)
        {
            var column = this.tableColumns[tableName][columnNames[i]];
            if(!strColumns.includes(column['gui_type_name'])) continue;
            
            var filter = {};
            filter[column['name']] =
            {
                "type": 1,
                "guiType": "string",
                "filter": search
            };
            
            await this.getListDataFromTable(tableName, filter, 3)
            .then(async (data) =>
            {
                if(data == null) return;

                for(var i = 0; i < data['records'].length; i++)
                {
                    var rec = data['records'][i];
                    
                    var gColumn = this.tableGeoColumns[tableName][0];
                    var geoFeature = MapHelper.getFeatureFromWkt(rec[gColumn['name']], "EPSG:"+gColumn['srid']);
                
                    temp.push(
                    {
                        'type': 'default',
                        'tableName': tableName,
                        'tableDisplayName': data['table_info']['display_name'],
                        //'feature': geoFeature,
                        'data': rec,
                        'response': rec
                    });
                }
                
                await BaseHelper.sleep(500);
            });
       }
        
       return new Promise((resolve) => resolve(temp));
    }
    
    getSearchedFeatureInfoFromLayer(layer, search)
    {
        switch(layer['authData']['layerTableType'])
        {
            case 'default':
                return this.getSearchedFeatureInfoFromDefaultLayer(layer, search);
            case 'external':
                return null;
            case 'custom':
                return this.getSearchedFeatureInfoFromCustomLayer(layer, search);
            default : 
                return null;
        }
    }*/
    
    async searchWithString(search)
    {
        try
        {
            this.generalHelper.startLoading();
            this.searching = true;
            this.featureList = {};
            
            this.showFeatureListTable();
            
            var layerTypes = ["default", "custom"];
            var layers = MapHelper.getLayersFromMapWithoutBaseLayers(this.map);            
            for(var i = 0; i < layers.length; i++) 
            {
                if(!layers[i].getVisible())
                {
                    if(layers[i]['layerAuth']) continue;
                    if(!layers[i]['search']) continue;
                }
                
                if(!layerTypes.includes(layers[i]['authData']['layerTableType']))
                {
                    console.log("external layer arama atlandı", layers[i]);
                    continue;
                }
                
                await this.searchOnTableWithString(layers[i], search);
                await BaseHelper.sleep(500);                
            }
            
            this.searching = false;
            this.generalHelper.stopLoading();
        }
        catch(ex)
        {
            this.messageHelper.toastMessage("Aradığınız nesneler getirilirken hata oluştu!");
            this.generalHelper.stopLoading();
            this.searching = false;
        }
    }
    
    async searchOnTableWithString(layer, words)
    {
        var info = BaseHelper.loggedInUserInfo;
        if(info == null) return this.nullTableAuth();
       
        if(typeof info["auths"] == "undefined") return this.nullTableAuth();
        if(typeof info["auths"]["tables"] == "undefined") return this.nullTableAuth();

        var tables = info["auths"]["tables"];        
        var tableName = layer.authData.tableName;
        var table = tables[tableName];
        
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "search/"+tableName+"/"+encodeURI(words);
        
        var th = this;

        var listId = table['lists'][0];
        var queryId = listId;
        
        try
        {
            queryId = table['queries'][0];
        }
        catch(e) {}
        
        return this.sessionHelper.doHttpRequest("POST", url, 
        {
            'column_array_id': listId,
            'column_array_id_query': queryId,
            'page': 1
        })
        .then((data) => 
        {
            var tName = data["table_info"]['name'];
            var tDisplayName = data["table_info"]['display_name'];
            
            if(typeof this.featureList[tName] == "undefined")
                this.featureList[tName] = 
                {
                    name: tName,
                    display_name: tDisplayName,
                    records: []
                };

            for(var i = 0; i < data["records"].length; i++)
            {
                var rec = data["records"][i];
                
                rec["_tableName"] = tName;
                rec["_summaries"] = {};
                rec["_type"] = "default";
                
                var columnNames = this.getKeys(rec);
                for(var j = 0; j < columnNames.length; j++)
                {
                    var columnName = columnNames[j];
                    if(columnName.substr(0, 1) == '_') continue;
                    
                    rec["_summaries"][columnName] = {};
                                        
                    rec["_summaries"][columnName]["data"] = this.getSummary(rec[columnName]);
                    rec["_summaries"][columnName]["displayName"] = data["columns"][columnName]["display_name"];  
                    
                    
                    if(this.isWkt(rec[columnName]))
                    {
                        var geoFeature = MapHelper.getFeatureFromWkt(rec[columnName], "EPSG:"+data["columns"][columnName]["srid"])
                        rec["_feature"] = geoFeature;  
                    }     
                }
                
                this.featureList[tName]['records'][rec['id']] = rec;
            }
        });
    }
    
    async showClickedFeatureInfo(event)
    {
        try
        {
            this.generalHelper.startLoading();
            this.searching = true;            
            this.featureList = [];
            this.showFeatureListTable();
            
            var buffer = this.getPolygonFromClickedPoint(event.coordinate);
                    
            var layers = MapHelper.getLayersFromMapWithoutBaseLayers(this.map);
            for(var i = 0; i < layers.length; i++)
            {                 
                if(!layers[i]['search']) continue;    
                if(!layers[i].getVisible()) if(layers[i]['layerAuth']) continue;

                if(layers[i].authData.layerTableType == "default")
                {
                    var control = false;
                    for(var j = 0; j < layers.length; j++)
                    {
                        if(layers[j].authData.layerTableType == "custom")
                        {
                            if(layers[i].tableName == layers[j].tableName)
                                if(!layers[j].getVisible())
                                {
                                    control = true;
                                    break;
                                }
                        }
                        else if(layers[j].authData.layerTableType == "external")
                        {
                            if(layers[j].relationTables.includes(layers[i].tableName))
                                if(!layers[j].getVisible())
                                {
                                    control = true;
                                    break;
                                }
                        }
                    }

                    if(control) continue;
                }    
                                                
                this.getClickedFeatureInfoFromLayer(layers[i], event, buffer);
            }
            
            this.searching = false;
            this.generalHelper.stopLoading();
        }
        catch(ex)
        {
            this.searching = false;
            this.messageHelper.toastMessage("Tıklanılan noktadaki nesneler getirilirken hata oluştu!");
            this.generalHelper.stopLoading()
        }
    }
        
    showFeatureListTable()
    {
        $('#featureListTableModal').modal('show');
    }
    
    showFeatureInfoPage(feature)
    {
        this.lastSelectedFeatureData = feature;
        
        switch(feature['_type'])
        {
            case 'external':
                this.showFeatureInfoPageExternal(feature);
                break;
            case 'default':
                this.showFeatureInfoPageDefault(feature);
                break;
        }
    }
    
    showFeatureInfoPageExternal(feature)
    {
        setTimeout(() =>
        {
            $('#externalFeatureInfoModal').modal('show');
        }, 100);
    }
    
    showFeatureInfoPageDefault(feature)
    {
        setTimeout(() =>
        {
            $('#defaultFeatureInfoModal').modal('show');
        }, 100);
    }
    
    /*lastSelectedFeatureType(typeName)
    {
        if(typeof this.lastSelectedFeatureData['type'] == 'undefined') return false;
        
         return this.lastSelectedFeatureData['type'] == typeName;
    }*/
    
    /*setFeatureList(features)
    {
        var tableNames = Object.keys(features);
        
        if(tableNames.length == 0)
        {
            this.messageHelper.toastMessage("Tıkladığınız alanda nesne bulunamadı");
            return;
        }
        else if(tableNames.length > 1)
        {
            this.showFeatureListTable(features);
            return;
        }
        
        var recs = features[tableNames[0]]['records'];
        var recIds = Object.keys(recs);
        
        if(recIds.length > 1)
            this.showFeatureListTable(features);
        else
            this.showFeatureInfoPage(recs[recIds[0]]);
    }*/
    
    getClickedFeatureInfoFromLayer(layer, event, buffer)
    {
        switch(layer['authData']['layerTableType'])
        {
            case 'default':
                return this.getClickedFeatureInfoFromDefaultLayer(layer, event, buffer);
            case 'external':
                return this.getClickedFeatureInfoFromExternalLayer(layer, event, buffer);
            case 'custom':
                return this.getClickedFeatureInfoFromCustomLayer(layer, event, buffer);
            default : 
                return null;
        }
    }
    
    getParamsForClickedFeatureInfoFromExternalLayerWMS(layer, srid, buffer)
    {
        buffer = MapHelper.transformFeatureCoorditanes(buffer, MapHelper.mapProjection, srid);
        
        var ext = buffer.getGeometry().getExtent();
        var bbox = ext[0]+","+ext[1]+","+ext[2]+","+ext[3];
        
        buffer = MapHelper.transformFeatureCoorditanes(buffer, srid, MapHelper.mapProjection);
        
        var params = 
        {
            SERVICE: "WMS",
            VERSION: "1.1.1",
            REQUEST: "GetFeatureInfo",
            QUERY_LAYERS: layer['authData']['workspace']+":"+layer['authData']['layer_name'],
            LAYERS: layer['authData']['workspace']+":"+layer['authData']['layer_name'],
            INFO_FORMAT: "application/json",
            FEATURE_COUNT: "5",
            X: "50",
            Y: "50",
            SRS: srid,
            WIDTH: "101",
            HEIGHT: "101",
            BBOX: bbox 
        };
        
        return params;
    }
    
    getParamsForClickedFeatureInfoFromExternalLayerWFS(layer, srid, buffer)
    {
        var ext = buffer.getGeometry().getExtent();//Alreadey EPSG:3857
        
        var params = 
        {
            service: "WFS",
            version: "1.1.0",
            request: "GetFeature",
            typename: layer['authData']['workspace']+":"+layer['authData']['layer_name'],
            outputFormat: "application/json",
            srsname: srid,
            bbox: ext[0]+","+ext[1]+","+ext[2]+","+ext[3]+",EPSG:3857"
        };
        
        return params;
    }
    
    async getClickedFeatureInfoFromExternalLayer(layer, event, buffer)
    {
        console.log("getClickedFeatureInfoFromExternalLayer");
        return;
        
        //buradan promise dömek zorunda değil
        //işimi hallet feature list doldur dışarısı seni await ile bekliyor...
        
            
        
        
        var srid = layer['authData']['srid'];
        if(srid == null || srid.length == 0) srid = MapHelper.dbProjection;
            
        var url = layer['authData']['base_url'];
        
        var params = {};
        
        if(layer['authData']['type'].split(":")[0] == "wms") 
            params = this.getParamsForClickedFeatureInfoFromExternalLayerWMS(layer, srid, buffer);
        else if(layer['authData']['type'] == "wfs") 
            params = this.getParamsForClickedFeatureInfoFromExternalLayerWFS(layer, srid, buffer);
        else
            return new Promise((resolve) => resolve(null));
        
        return new Promise((resolve) =>
        {
            $.ajax(
            {
                dataType: "json",
                url: url,
                data: params,
                success: (data) =>
                {
                    var temp = [];
                    for(var i = 0; i < data['features'].length; i++)
                    {
                        var feature = data['features'][i];
                        var tableName = feature.id.split(".")[0];
                        
                        var geoFeature = MapHelper.getFeatureFromGeoserverJsonResponseGeometry(feature['geometry']);
                        geoFeature = MapHelper.transformFeatureCoorditanes(geoFeature, srid, MapHelper.mapProjection);
                        
                        temp.push(
                        {
                            'type': 'external',
                            'tableName': tableName,
                            'tableDisplayName': layer['authData']['display_name'],
                            'feature': geoFeature,
                            'data': feature.properties,
                            'response': feature
                        })
                    }
                    
                    //burada this.featurelist içinde doldur
                    //örneğine bakarak
                    //resolve(temp);
                }
            });
        });
    }
    
    getClickedFeatureInfoFromCustomLayer(layer, event, buffer)
    {
        var temp = new Promise((resolve) => resolve(null));

        var auth = BaseHelper.loggedInUserInfo.auths.tables;
        if(typeof auth[layer.tableName] == "undefined") return temp;
        if(typeof auth[layer.tableName]["maps"] == "undefined") return temp;
        if(!auth[layer.tableName]["maps"].includes("2")) return temp;//Search
        
        return this.getClickedFeatureInfoFromDefaultLayer(layer, event, buffer);
    }
    
    /*getListDataFromTable(tableName, filters = {}, limit = 0)
    {
        var auth = BaseHelper.loggedInUserInfo.auths.tables[tableName];
        if(typeof auth['lists'] == "undefined")
        {
            alert('"'+tableName+'" katmanının liste yetkisi yok!');
            return new Promise((resolve) => resolve(null));
        }

        var columnArrayId = auth['lists'][0];
        
        var columnArrayIdQuery = null;
        if(typeof auth['queries'] == "undefined") columnArrayIdQuery = columnArrayId;
        else columnArrayIdQuery = auth['queries'][0];
        
        var params =
        {
            "page": 1,
            "limit": limit,
            "column_array_id": columnArrayId,
            "column_array_id_query": columnArrayIdQuery,
            "sorts": {},
            "filters": filters,
            "sender": "fullscreenMapElement"
        };
        
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "tables/"+tableName;
        
        return new Promise(async (resolve) =>
        {
            this.sessionHelper.disableDoHttpRequestErrorControl = true;
            
            await this.sessionHelper.doHttpRequest("POST", url, {params: BaseHelper.objectToJsonStr(params)}) 
            .then((data) => resolve(data))
            .catch((er) => resolve(null));
            
            this.sessionHelper.disableDoHttpRequestErrorControl = false;
        }); 
    }*/
    
    /*async fillTableColumns(tableName)
    {
        if(typeof this.tableGeoColumns[tableName] != "undefined") return true;
        
        var geoColumns = ['point', 'linestring', 'polygon', 'multipoint', 'multilinestring', 'multipolygon'];
        
        var temp = false;

        await this.getListDataFromTable(tableName)
        .then((data) =>
        {
            if(data == null) return;

            this.tableColumns[tableName] = data['columns'];
            
            var columnNames = Object.keys(data['columns']);
            for(var i = 0; i < columnNames.length; i++)
            {
                var columnName = columnNames[i];
                var column = data['columns'][columnName];
                
                if(geoColumns.includes(column['gui_type_name']))
                {
                    if(typeof this.tableGeoColumns[tableName] == "undefined")
                        this.tableGeoColumns[tableName] = [];
                        
                    this.tableGeoColumns[tableName].push(column);
                }
            }

            temp = true;
        });

        return temp;
    }*/
    
    async getClickedFeatureInfoFromDefaultLayersWithInterval(layers, event, buffer)
    {
        BaseHelper.pipe["clickedFeatureInfoFromDefaultLayers"] = [];
        
        var info = BaseHelper.loggedInUserInfo;
        if(info == null) return this.nullTableAuth();
        if(typeof info["auths"] == "undefined") return this.nullTableAuth();
        if(typeof info["auths"]["tables"] == "undefined") return this.nullTableAuth();
        
        var tableAuths = info["auths"]["tables"];
        
        var params = {};
        params["tables"] = [];
        for(var i = 0; i < layers.length; i++)
        {
            var layer = layers[i];
            var tableName = layer['authData']['tableName'];
        
            var tableAuth = tableAuths[tableName];
            var listId = tableAuth['lists'][0];
            var queryId = listId;
            try
            {
                queryId = tableAuth['queries'][0];
            }
            catch(e) {}
            
            var tableData = {
                'name':  tableName,
                'column_array_id': listId,
                'column_array_id_query': queryId
            };

            params["tables"].push(tableData);
        }
        
        params["wkt"] = MapHelper.getWktFromFeature(buffer);

        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;        
        url += "searchGeoInMultiTables";
                
        return this.sessionHelper.doHttpRequest("POST", url, { 'params': BaseHelper.objectToJsonStr(params) })
        .then((multiData) => 
        {
            var tableNames = Object.keys(multiData);
            for(var k = 0; k < tableNames.length; k++)
            {
                var data = multiData[tableNames[k]];
                
                var tName = data["table_info"]['name'];
                var tDisplayName = data["table_info"]['display_name'];

                if(typeof this.featureList[tName] == "undefined")
                    this.featureList[tName] = 
                    {
                        name: tName,
                        display_name: tDisplayName,
                        records: []
                    };

                for(var i = 0; i < data["records"].length; i++)
                {
                    var rec = data["records"][i];

                    rec["_tableName"] = tName;
                    rec["_summaries"] = {};
                    rec["_type"] = "default";

                    var columnNames = this.getKeys(rec);
                    for(var j = 0; j < columnNames.length; j++)
                    {
                        var columnName = columnNames[j];
                        if(columnName.substr(0, 1) == '_') continue;

                        rec["_summaries"][columnName] = {};

                        rec["_summaries"][columnName]["data"] = this.getSummary(rec[columnName]);
                        try 
                        {
                            rec["_summaries"][columnName]["displayName"] = data["columns"][columnName]["display_name"];  
                        } 
                        catch (error) 
                        {
                            rec["_summaries"][columnName]["displayName"] = columnName;
                        }

                        if(this.isWkt(rec[columnName]))
                        {
                            var geoFeature = MapHelper.getFeatureFromWkt(rec[columnName], "EPSG:"+data["columns"][columnName]["srid"])
                            rec["_feature"] = geoFeature;    
                        }     
                    }

                    this.featureList[tName]['records'][rec['id']] = rec;
                }
            }
        });
    }
    
    async getClickedFeatureInfoFromDefaultLayer(layer, event, buffer)
    {
        if(typeof BaseHelper.pipe["clickedFeatureInfoFromDefaultLayers"] == "undefined") BaseHelper.pipe["clickedFeatureInfoFromDefaultLayers"] = [];
        
        BaseHelper.pipe["clickedFeatureInfoFromDefaultLayers"].push(layer);
        
        var params = {
            'this': this,
            'layers': BaseHelper.pipe["clickedFeatureInfoFromDefaultLayers"],
            'event': event,
            'buffer': buffer
        };
        
        BaseHelper.doInterval(
            'getClickedFeatureInfoFromDefaultLayersWithInterval', 
            (params) => params['this'].getClickedFeatureInfoFromDefaultLayersWithInterval(params.layers, params.event, params.buffer), 
            params, 
            250);
    }
    
    /*getColumnDisplayName(tableName, columnName)
    {
        if(typeof this.tableColumns[tableName] == "undefined") return columnName;
        if(typeof this.tableColumns[tableName][columnName] == "undefined") return columnName;
        if(typeof this.tableColumns[tableName][columnName]['display_name'] == "undefined") return columnName;
        
        return this.tableColumns[tableName][columnName]['display_name']
    }*/
    
    getSummary(data)
    {
        if(data == null) return null;

        if(this.isWkt(data)) return null;
        
        data = data.toString();
        if(data.length < 50) return data;
        
        return data.substring(0, 50) + "...";
    }

    isWkt(data)
    {
        if(data == null) return false;
        
        data = data.toString();

        if(data.substr(0, 7).toUpperCase() == 'POLYGON') return true;
        else if(data.substr(0, 5).toUpperCase() == 'POINT') return true;
        else if(data.substr(0, 10).toUpperCase() == 'LINESTRING') return true;
        else if(data.substr(0, 12).toUpperCase() == 'MULTIPOLYGON') return true;
        else if(data.substr(0, 10).toUpperCase() == 'MULTIPOINT') return true;
        else if(data.substr(0, 15).toUpperCase() == 'MULTILINESTRING') return true;

        return false;
    }

    addEventForDataChanged(map)
    {
        var th = this;
        map.on('dataChanged', (event) =>
        {
            switch(event.constructor.name)
            {
                case 'DrawEvent':
                    th.endDrawIsSingleFeatureDrawed(event);
                    th.addFeatureOnVectorFeaturesTree(event.feature);
                    break;
            }
        });
    }

    addEventForSelectArea(map)
    {
        
        var th = this;

        $(document).on('keyup keydown', function(e)
        {
            th.ctrlPressed = e.ctrlKey;
            th.altPressed = e.altKey;
        });

        map.on('pointerdown', function(e) 
        {        
            if(!th.featuresTreeVisible) return;
            if(!th.ctrlPressed || !th.altPressed) return;

            th.selectAreaStartPixel = e.pixel;
        });

        map.on('pointerup', function(e) 
        {        
            if(th.selectAreaStartPixel == null) return;

            th.areaSelected(th.selectAreaStartPixel, e.pixel);
            th.selectAreaStartPixel = null;
        });

        map.on('pointermove', function(e) 
        {        
            if(th.selectAreaStartPixel == null) return;
            if(!th.featuresTreeVisible) return;
            if(!th.ctrlPressed || !th.altPressed) return;

            th.drawSelectArea(e.pixel);
        });

        $(document).on("mousemove", "#selectArea", function(e) 
        {
            if(th.selectAreaStartPixel == null) return;
            if(!th.featuresTreeVisible) return;
            if(!th.ctrlPressed || !th.altPressed) return;

            th.drawSelectArea([e.clientX, e.clientY]);
        });
    }

    areaSelected(selectAreaStartPixel, selectAreaEndPixel)
    {
        $('#selectArea').remove();

        this.selectTypeAndDo(this.typesMatch, (typeName) =>
        {
            this.selectIntectsFeatureWithArea(typeName, selectAreaStartPixel, selectAreaEndPixel);
        });
    }

    getTurfPolygonFromStartAndEndPixel(selectAreaStartPixel, selectAreaEndPixel)
    {
        var start = this.map.getCoordinateFromPixel(selectAreaStartPixel);
        var end = this.map.getCoordinateFromPixel(selectAreaEndPixel);

        return turfPolygon(
        [
            [
                [start[0], start[1]],
                [end[0], start[1]],
                [end[0], end[1]],
                [start[0], end[1]],
                [start[0], start[1]]
            ]
        ]);
    }

    getTurfPolygonFromExtent(extent)
    {
        return turfPolygon(
        [
            [
                [extent[0], extent[1]],
                [extent[2], extent[1]],
                [extent[2], extent[3]],
                [extent[0], extent[3]],
                [extent[0], extent[1]]
            ]
        ]);
    }

    selectIntectsFeatureWithArea(type, selectAreaStartPixel, selectAreaEndPixel)
    {
        var turfPolygon = this.getTurfPolygonFromStartAndEndPixel(selectAreaStartPixel, selectAreaEndPixel);
        
        var control = false;

        var classNames = this.getClassNames();
        for(var i = 0; i < classNames.length; i++)
        {
            var className = classNames[i];
            if(!this.vectorFeaturesTree[className]['visible']) continue;

            var subClassNames = this.getSubClassNames(className);
            for(var j = 0; j < subClassNames.length; j++)
            {
                var subClassName = subClassNames[j];
                if(!this.vectorFeaturesTree[className]['data'][subClassName]['visible']) continue;

                var subClassData = this.vectorFeaturesTree[className]['data'][subClassName]['data'];

                if(typeof subClassData[type] == "undefined") continue;
                if(!subClassData[type]['visible']) continue;

                var data = subClassData[type]['data'];
                for(var k = 0; k < data.length; k++)
                {
                    var ext = data[k].getGeometry().getExtent();

                    if(ext[0] == ext[2])//Point to poly
                    {
                        ext[2] += 1;
                        ext[3] += 1;
                    }

                    var poly = this.getTurfPolygonFromExtent(ext);

                    if(turfIntersect(turfPolygon, poly))
                    {
                        control = true;
                        data[k].selected = true;
                    } 
                }
            }
        }

        if(control) this.updateFeatureStyles();
    }

    drawSelectArea(selectAreaEndPixel)
    {
        if(this.selectAreaStartPixel == null) return;

        var x1, x2, y1, y2;
        
        if(selectAreaEndPixel[0] > this.selectAreaStartPixel[0])
            x1 = this.selectAreaStartPixel[0];
        else
            x1 = selectAreaEndPixel[0];
        
        if(selectAreaEndPixel[1] > this.selectAreaStartPixel[1])
            y1 = this.selectAreaStartPixel[1];
        else
            y1 = selectAreaEndPixel[1];
        
        var fW = selectAreaEndPixel[0] - this.selectAreaStartPixel[0];
        var fH = selectAreaEndPixel[1] - this.selectAreaStartPixel[1];
        
        if(fW < 0) fW = -1 * fW;
        if(fH < 0) fH = -1 * fH;
        
        var o = $('canvas').offset();
        
        $('#selectArea').remove();
        
        var html = "<div id='selectArea' style='top:"+(y1+o.top)+"px;left:"+(x1+o.left)+"px;";
        html += "position: absolute; z-index: 3999999999;border:3px solid #cf6729;";
        html += "width:"+fW+"px;height:"+fH+"px'></div>";

        $('body').append(html);
    }

    selectClickedFeatureOnVectorSourceTree(event)
    {
        MapHelper.getFeaturesAtPixel(this.map, event.pixel)
        .then((data) =>
        {
            if(typeof data['vector'] == "undefined") return;

            for(var i = 0; i < data['vector'].length; i++)
                if(data['vector'][i].visible)
                    data['vector'][i].selected = !data['vector'][i].selected;
            
            this.updateFeatureStyles();
        });
    }

    createIfNotExistClassOnVectorSourceTree(className)
    {
        if(typeof this.vectorFeaturesTree[className] == "undefined")
        {
            this.vectorFeaturesTree[className] = {};
            this.vectorFeaturesTree[className]['visible'] = true;
            this.vectorFeaturesTree[className]['data'] = {};        
        }
    }

    createIfNotExistSubClassOnVectorSourceTree(className, subClassName)
    {
        if(typeof this.vectorFeaturesTree[className]['data'][subClassName] == "undefined")
        {
            this.vectorFeaturesTree[className]['data'][subClassName] = {};
            this.vectorFeaturesTree[className]['data'][subClassName]['visible'] = true;
            this.vectorFeaturesTree[className]['data'][subClassName]['data'] = {};        
        }
    }

    createIfNotExistTypeOnVectorSourceTree(className, subClassName, typeName)
    {
        if(typeof this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName] == "undefined")
        {
            this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName] = {};
            this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['visible'] = true;
            this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'] = [];            
        }
    }

    addFeatureOnVectorFeaturesTree(feature)
    {
        var className = "Yerel Nesneler";
        var subClassName = "Çizimler";
        var typeName = feature.getGeometry().getType().toLowerCase();

        feature['featureObject'] = {'type': 'drawed'};
        feature['selected'] = false;
        feature['visible'] = true;
        feature['className'] = className;
        feature['subClassName'] = subClassName;
        feature['typeName'] = typeName;

        this.createIfNotExistClassOnVectorSourceTree(className);
        this.createIfNotExistSubClassOnVectorSourceTree(className, subClassName);
        this.createIfNotExistTypeOnVectorSourceTree(className, subClassName, typeName);

        var i = this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'].length;
        feature['index'] = i;

        this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'].push(feature);

        this.featuresTreeVisible = true;
    }

    endDrawIsSingleFeatureDrawed(event)
    {
        if(!this.waitDrawSingleFeature) return;
        this.drawEnd();
    }

    addLayers(map)
    {
        var layerAuths = this.getLayerAuhts(map);
        return MapHelper.addLayersFromMapAuth(map, layerAuths);
    }

    getBaseLayers()
    {
        return MapHelper.getBaseLayersFromMap(this.map);
    }

    layerFilterChanged()
    {
        this.layers = this.getLayers();
    }

    getLayers()
    {
        var tempArray = [];
        var temp = MapHelper.getLayersFromMapWithoutBaseLayers(this.map);
        for(var i = 0; i < temp.length; i++)
            if(temp[i]["layerAuth"])
            {
                if(this.layerFilterString.length == 0) 
                    tempArray.push(temp[i]);
                else if(temp[i].display_name.toLocaleLowerCase().indexOf(this.layerFilterString.toLocaleLowerCase()) > -1)
                    tempArray.push(temp[i]);
            }
 
        this.layerList = tempArray.reverse();

        return this.layerList;
    }
    
    changeBaseLayer(e)
    {
        var val = parseInt(e.target.value);
        MapHelper.changeBaseLayer(this.map, val);
    }

    getSelectedBaseLayerIndex()
    {
        var baseLayers = MapHelper.getBaseLayersFromMap(this.map);
        for(var i = 0; i < baseLayers.length; i++)
            if(baseLayers[i].getVisible())
                return i;

        return -1;
    }

    layerChanged(event: CdkDragDrop<string[]>) 
    {
        var len = this.layerList.length - 1;
        var prev = len - event.previousIndex;
        var curr = len - event.currentIndex;
        
        var diff = curr - prev;
        if(diff == 0) return;

        MapHelper.moveLayer(this.map, this.layerList[event.previousIndex], diff);
    }

    changeLayerVisibility(layer)
    {
        MapHelper.changeLayerVisibility(this.map, layer);
    }
    
    showLegend(layer)
    {
        if(layer["legend_url"] != null && layer["legend_url"].length > 0) this.legendUrl = layer["legend_url"];
        else 
        {
            this.messageHelper.sweetAlert("Bu katmanın lejantı yok!", "Lejant bulunamadı", "warning");
            return;
        }
        
        this.legendUrl = this.legendUrl.replace("***width***", "100");
        this.legendUrl = this.legendUrl.replace("***height***", "200");
        this.legendUrl = this.legendUrl.replace("***token***", this.token);
        
        this.showLegendPanel = true;
    }
    
    closeLegendPanel()
    {
        this.showLegendPanel = false;
    }

    zoomOut()
    {
        MapHelper.zoom(this.map, false);
    }

    zoomIn()
    {
        MapHelper.zoom(this.map, true);
    }

    deleteKmlOrKmzFileFeatures(name)
    {
        console.log("delete: " + name);
    }

    addFeaturesFromKmzOrKmlFile(tree)
    {
        var name = $('#kmzFile')[0].files[0].name;

        if(typeof this.vectorFeaturesTree[name] != "undefined")
            this.deleteKmlOrKmzFileFeatures(name);

        this.createIfNotExistClassOnVectorSourceTree(name);
        
        var tempFeatures = [];

        var layers = Object.keys(tree);
        for(var i = 0; i < layers.length; i++)
        {
            var layer = layers[i];            
            this.createIfNotExistSubClassOnVectorSourceTree(name, layer);

            var types = Object.keys(tree[layer]);
            for(var j = 0; j < types.length; j++)
            {
                var type = types[j];                   
                this.createIfNotExistTypeOnVectorSourceTree(name, layer, type);

                var features = tree[layer][type];
                for(var k = 0; k < features.length; k++)
                {
                    var featureObject = tree[layer][type][k];

                    var feature = MapHelper.getFeatureFromWkt(featureObject['wkt']);
                    feature['featureObject'] = featureObject;
                    feature['selected'] = false;
                    feature['visible'] = true;
                    feature['className'] = name;
                    feature['subClassName'] = layer;
                    feature['typeName'] = type;
                    feature['index'] = k;

                    this.vectorFeaturesTree[name]['data'][layer]['data'][type]['data'].push(feature);
                    tempFeatures.push(feature);
                }
            }
        }

        MapHelper.addFeatures(this.map, tempFeatures)
        .then((features) =>
        {
            this.updateFeatureStyles();
            
            MapHelper.zoomToFeatures(this.map, features)
        });
    }

    uploadKmz()
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "translateKmzOrKmlToJson";
        
        var params = new FormData();
        params.append("file", $('#kmzFile')[0].files[0]);

        this.generalHelper.startLoading();
        
        this.sessionHelper.doHttpRequest("POST", url, params) 
        .then((data) => 
        {
            this.generalHelper.stopLoading();
            
            if(data == null)
                this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
            else 
            {
                this.addFeaturesFromKmzOrKmlFile(data);
                this.updateInFormSelectDataForColumn();
                
                MapHelper.addModify(this.map, true);

                this.setFeaturesTreeVisible(true);
            }
            
            $('#kmzFile').val(""); 
        })
        .catch((e) => 
        { 
            $('#kmzFile').val("");
            this.generalHelper.stopLoading();
        });
    }
    
    convertToJson(data)
    {
        return BaseHelper.objectToJsonStr(data);
    }
    
    updateInFormSelectDataForColumn()
    {
        this.inFormSelectDataForColumn = this.inFormSelectDataForColumn.splice(0, 2);
        
        var temp = [];
        var classNames = Object.keys(this.vectorFeaturesTree);
        for(var i = 0; i < classNames.length; i++)
        {
            var className = classNames[i];
            
            var subClassNames = Object.keys(this.vectorFeaturesTree[className]['data']);
            for(var j = 0; j < subClassNames.length; j++)
                this.inFormSelectDataForColumn.push(
                {
                    "source": "fromData."+className+"."+subClassNames[j],
                    "display": "Nesneden data al: ["+className+"."+subClassNames[j]+"]"
                });
        }
    }

    getClassNames()
    {
        return Object.keys(this.vectorFeaturesTree);
    }

    toogleClassVisible(className)
    {
        var temp = this.vectorFeaturesTree[className]['visible'];
        this.vectorFeaturesTree[className]['visible'] = !temp;

        var data = this.vectorFeaturesTree[className]['data'];
        var subClassNames = this.getSubClassNames(className);
        for(var i = 0; i < subClassNames.length; i++)
        {
            var subClassName = subClassNames[i];
            this.vectorFeaturesTree[className]['data'][subClassName]['visible'] = temp;
            this.toogleSubClassVisible(className, subClassName);
        }
    }

    selectAllFeatureInClass(className)
    {
        var temp = null;

        var subClassNames = this.getSubClassNames(className);
        for(var i = 0; i < subClassNames.length; i++)
        {
            var subClassName = subClassNames[i];

            if(temp == null)
            {
                var types = this.getTypeNames(className, subClassName);
                var typeName = types[0];
                temp = this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'][0].selected;

            }
                
            var types = this.getTypeNames(className, subClassName);
            var typeName = types[0];
            this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'][0].selected = temp;
            this.selectAllFeatureInSubClass(className, subClassName);
        }
    }

    getSubClassNames(className)
    {
        return Object.keys(this.vectorFeaturesTree[className]['data']);
    }

    toogleSubClassVisible(className, subClassName)
    {
        var temp = !this.vectorFeaturesTree[className]['data'][subClassName]['visible'];
        this.vectorFeaturesTree[className]['data'][subClassName]['visible'] = temp;

        var data = this.vectorFeaturesTree[className]['data'][subClassName]['data'];
        var types = this.getTypeNames(className, subClassName);
        for(var i = 0; i < types.length; i++)
        {
            var typeName = types[i];
            this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['visible'] = !temp;
            this.toogleTypeVisible(className, subClassName, typeName);
        }
    }

    selectAllFeatureInSubClass(className, subClassName)
    {
        var temp = null;

        var types = this.getTypeNames(className, subClassName);
        for(var i = 0; i < types.length; i++)
        {
            var typeName = types[i];

            if(temp == null)
                temp = this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'][0].selected;

            this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'][0].selected = temp;
            this.selectAllFeatureInType(className, subClassName, typeName)
        }
    }

    getTypeNames(className, subClassName)
    {
        return Object.keys(this.vectorFeaturesTree[className]['data'][subClassName]['data']);
    }

    toogleTypeVisible(className, subClassName, typeName)
    {
        var temp = !this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['visible'];
        this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['visible'] = temp;

        var data = this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'];
        for(var i = 0; i < data.length; i++)
            data[i].visible = temp;
        
        this.updateFeatureStyles();
    }

    selectAllFeatureInType(className, subClassName, typeName)
    {
        var data = this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'];
        var temp = !data[0].selected;
        for(var i = 0; i < data.length; i++)
            data[i].selected = temp;
        
        this.updateFeatureStyles();
    }

    getFeatures(className, subClassName, typeName)
    {
        return this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'];
    }

    toggleFeatureSelected(className, subClassName, typeName, i)
    {
        var temp = !this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'][i]['selected'];
        this.vectorFeaturesTree[className]['data'][subClassName]['data'][typeName]['data'][i]['selected'] = temp;

        this.updateFeatureStyles();
    }

    updateFeatureStyles()
    {
        var tempFeatures = [];

        var features = MapHelper.getAllFeatures(this.map);
        for(var i = 0; i < features.length; i++)
        {
            var className = features[i].className;
            var subClassName = features[i].subClassName;
            var typeName = features[i].typeName;
            var index = features[i].index;
            
            var temp = this.vectorFeaturesTree[className]["data"][subClassName]["data"][typeName]["data"][index];
            if(typeof temp['visible'] == "undefined") continue;
            
            var type = BaseHelper.ucfirst(typeName);

            var style = null;
            if(!temp.visible)
                style = MapHelper.getInvisibleStyle(type);
            else
            {
                if(temp.selected)
                    style = MapHelper.getSelectedStyle(type, temp.featureObject.name);
                else
                    style = MapHelper.getDefaultStyle(type, temp.featureObject.name);
            }

            features[i].setStyle(style);
        }
    }

    drawEnd()
    {
        MapHelper.removeInteraction(this.map, this.drawingInteraction)
        .then((map) =>
        {
            this.drawingInteraction = null;
            this.waitDrawSingleFeature = false;
        })

    }

    drawStart(featureType, multi = false, freehand = false)
    {
        MapHelper.addDraw(this.map, featureType, true, freehand)
        .then((drawingInteraction) =>
        {
            this.waitDrawSingleFeature = !multi;
            this.drawingInteraction = drawingInteraction;        
        })
    }
    
    getSelectedFeatures()
    {
        var selectedFeatures = {};

        var features = MapHelper.getAllFeatures(this.map);
        for(var i = 0; i < features.length; i++)
        {
            if(!features[i].selected) continue;
            
            var typeName = features[i].typeName;
            
            if(typeof selectedFeatures[typeName] == "undefined") 
                selectedFeatures[typeName] = [];
                
            selectedFeatures[typeName].push(features[i]);
        }
        
        return selectedFeatures;
    }
    
    convertSelectedFeaturesToPoint()
    {
        var selectedFeatures = this.getSelectedFeatures();
        var types = Object.keys(selectedFeatures);
        
        if(!types.includes("polygon") && !types.includes("linestring"))
            return this.messageHelper.toastMessage('Aktarmak için seçilmiş nesne yok!');
        
        var t = ['polygon', 'linestring'];
        for(var i = 0; i < t.length; i++)
        {
            var features = selectedFeatures[t[i]];
            
            if(typeof features == "undefined") continue;
            
            for(var j = 0; j < features.length; j++)
            {
                var feature = features[j];                
                                
                var newFeature = MapHelper.getCenterFeatureFromFeature(feature);

                newFeature['featureObject'] = {'type': 'convertToPoint'};
                newFeature['selected'] = true;
                newFeature['visible'] = true;
                newFeature['className'] = feature['className'];
                newFeature['subClassName'] = feature['subClassName'];
                newFeature['typeName'] = 'point';
        
                this.removeFeature(feature);
                
                this.createIfNotExistClassOnVectorSourceTree(newFeature['className']);
                this.createIfNotExistSubClassOnVectorSourceTree(newFeature['className'], newFeature['subClassName']);
                this.createIfNotExistTypeOnVectorSourceTree(newFeature['className'], newFeature['subClassName'], 'point');

                var index = this.vectorFeaturesTree[newFeature['className']]['data'][newFeature['subClassName']]['data']['point']['data'].length;
                newFeature['index'] = index;

                MapHelper.addFeatures(this.map, [newFeature]);
                this.vectorFeaturesTree[newFeature['className']]['data'][newFeature['subClassName']]['data']['point']['data'].push(newFeature);
                
                this.updateFeatureStyles();
            }
        }
    }
    
    dataTransport()
    {
        if(!this.isUpTableRecordSelected()) 
            return this.messageHelper.toastMessage('Önce bir kaydı veri aktarılacak kayıt olarak belirlemelisiniz!');
        
        var selectedFeatures = this.getSelectedFeatures();
        var types = Object.keys(selectedFeatures);
        if(types.length == 0)
            return this.messageHelper.toastMessage('Aktarmak için seçilmiş nesne yok!');
        else if(types.length == 1)
            return this.dataTransportByTypeName(types[0]);
            
        var temp = {};
        for(var i = 0; i < types.length; i++)
            temp[types[i]] = this.typesMatch[types[i]];            
            
            
        this.selectTypeAndDo(temp, (typeName) =>
        {
            this.dataTransportByTypeName(typeName);
        });
    }
    
    dataTransportByTypeName(typeName)
    {
        this.getTargetTableAndColumnForDataTransport(typeName)
        .then((target) =>
        {
            if(target['length'] == 0) return;

            target['type'] = typeName;
            this.openDataTransformForm(target);
        })
    }
    
    openDataTransformForm(target)
    {
        this.inFormTargetData['subTable'] = target;
        
        this.inFormTableName = target.tableName;
        this.inFormColumnName = target.columnName;
        
        var loggedInUserId = BaseHelper.loggedInUserInfo['user']['id'];
        var key = 'user:'+loggedInUserId+'.dataTransport';
        this.inFormTargetData['baseTable'] = BaseHelper.readFromLocal(key);

        this.inFormRecordId = 0;

        var rand = Math.floor(Math.random() * 10000) + 1;
        this.inFormElementId = "ife-"+rand;
        
        setTimeout(() => 
        {
            $('#'+this.inFormElementId+'inFormModal').modal('show');
        }, 100);
    }
    
    getTargetTableAndColumnForDataTransport(typeName)
    {
        return new Promise((resolve) =>
        {
            var loggedInUserId = BaseHelper.loggedInUserInfo['user']['id'];
            var key = 'user:'+loggedInUserId+'.dataTransport';

            var temp = BaseHelper.readFromLocal(key);
        
            var url = this.sessionHelper.getBackendUrlWithToken();
            if(url.length == 0) return;

            url += "getSubTables/"+temp['tableName']+"/"+typeName;
            
            this.generalHelper.startLoading();
            this.sessionHelper.doHttpRequest("POST", url)
            .then(async (data) => 
            {
                this.generalHelper.stopLoading();
                if(data['length'] == 0)
                {
                    this.messageHelper.toastMessage("Bu tür için yetiniz bulunan bir tablo yok");
                    resolve([]);
                }
                else if(data['length'] == 1)
                    resolve(data[0]);
                else
                {
                    var inputOptions = {};
                    for(var i = 0; i < data['length']; i++)
                        inputOptions[i] = data[i]['tableDisplayName'] + ' tablosunun ' + data[i]['columnDisplayName'] + ' kolonuna';
                    
                    const { value: id } = await Swal.fire(
                    {
                        title: 'Aktarmak istediğiniz tablo ve kolon',
                        input: 'select',
                        inputOptions: inputOptions,
                        inputPlaceholder: 'Seçiniz',
                        showCancelButton: false
                    });

                    if (typeof id == "undefined") return;
                    if (id == "") return;

                    resolve(data[id]);
                }
            })
            .catch((e) => { this.generalHelper.stopLoading(); });
        }); 
    }
    
    isMobileDevice()
    {
        return BaseHelper.isMobileDevice;
    }
    
    inFormLoaded(event)
    {
        this.fillAndHideBaseColumns();
    }
    
    fillAndHideBaseColumns()
    {
        this.fillSourceRecordIdColumn();
        this.fillTableIdColumn();
        
        this.hideBaseColumns();
    }
    
    hideBaseColumns()
    {
        $('#table_id-group').css('display', 'none');
        $('#source_record_id-group').css('display', 'none');
        $('#'+this.inFormTargetData['subTable']['columnName']+'-group').css('display', 'none');
    }
    
    fillSourceRecordIdColumn()
    {
        var recId = this.inFormTargetData['baseTable']['recordId'];
        $('#source_record_id').val(recId);
    }
    
    fillTableIdColumn()
    {
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "tables/"+this.inFormTargetData['subTable']['tableName']+"/";
        url += "getSelectColumnData/table_id?search=" + this.inFormTargetData['baseTable']['tableName'];
        
        $.ajax(
        {
            dataType: "json",
            type: "POST",
            url: url,
            data: null,
            success: (data) =>
            {
                var tableId = data['results'][0]['id'];        
                $('#table_id').html("<option value='"+tableId+"'></option>")
                $('#table_id').val(tableId);
            }
        });
    }
    
    getDataTransferSelects(data)
    {
        var dataTransferSelects = {};
        var columns = Object.keys(data);
        for(var i = 0; i < columns.length; i++)
        {
            var temp = $("#"+columns[i]+"-DTS").val();
            if(typeof temp == "undefined" || temp == "") continue;
            
            dataTransferSelects[columns[i]] = temp;
        }
        
        return dataTransferSelects;
    }
    
    getDataForDataTransformStore(record, feature, dataTransferSelects)
    {
        var columnNames = Object.keys(dataTransferSelects);
        for(var j = 0; j < columnNames.length; j++)
        {
            var columnName = columnNames[j];
            record[columnName] = this.convertDataForDataTransform(record, feature, columnName, dataTransferSelects[columnName]);
        }

        var wkt = MapHelper.getWktFromFeature(feature, null, "EPSG:"+this.inFormTargetData['subTable']['columnSrid']);            
        record[this.inFormTargetData['subTable']['columnName']] = wkt;
        
        return record;
    }
    
    async inFormSavedSuccess(data)
    {
        BaseHelper.closeModal(this.inFormElementId+'inFormModal');
        
        var dataTransferSelects = this.getDataTransferSelects(data);
        
        var url = this.sessionHelper.getBackendUrlWithToken();
        if(url.length == 0) return;
        
        url += "tables/"+this.inFormTargetData['subTable']['tableName']+"/store";

        var errorWhenFirstRecordStore = false;
        
        var temp = this.getSelectedFeatures();
        var selectedFeatures = temp[this.inFormTargetData['subTable']['type']];        
        for(var i = 0; i < selectedFeatures.length; i++)
        {
            if(errorWhenFirstRecordStore) break;
            
            var record = BaseHelper.getCloneFromObject(data);               
            var feature = selectedFeatures[i];
            
            record = this.getDataForDataTransformStore(record, feature, dataTransferSelects)
            
            await this.storeData(url, record, feature)
            .then((feature) =>
            {
                this.removeFeature(feature);
            })
            .catch((e) => 
            { 
                if(i == 0) errorWhenFirstRecordStore = true;
                this.messageHelper.toastMessage("Aktarım esnasında bir hata oluştu. Aktarım durduruldu");
                //$('#'+this.inFormElementId+'inFormModal').modal('show');
            });
            
            await BaseHelper.sleep(500);
        }
        
        if(errorWhenFirstRecordStore) 
            $('#'+this.inFormElementId+'inFormModal').modal('show');
        else
            this.messageHelper.toastMessage('Aktarım başarılı!');
    }
    
    storeData(url, data, feature)
    {
        return new Promise((resolve, error) => 
        {
            var request = this.sessionHelper.doHttpRequest("POST", url, data) 
            .then((data) => 
            {
                if(typeof data['message'] == "undefined")
                    error(data);
                else if(data['message'] == 'error')
                    error(data);
                else if(data['message'] == 'success')
                    resolve(feature)
                else
                    error(data);                
            })
            .catch((e) => { error(e) });
        });
    }
    
    removeFeature(feature)
    {
        MapHelper.deleteFeature(this.map, feature);
        
        var data = this.vectorFeaturesTree[feature.className]["data"][feature.subClassName]["data"][feature.typeName]["data"];
        data.splice(feature.index, 1);
        
        for(var i = feature.index; i < data.length; i++) data[i]['index']--;   
                
        this.vectorFeaturesTree[feature.className]["data"][feature.subClassName]["data"][feature.typeName]["data"] = data;
    }
    
    convertDataForDataTransform(record, feature, columnName, convertType)
    {
        switch(convertType.split('.')[0])
        {
            case 'length': return feature.getGeometry().getLength();
            case 'area': return feature.getGeometry().getArea();
            case 'fromData': 
                var temp = convertType.replace('.kmz', '').replace('.kml', '').split('.');

                var className = temp[1] + (typeof this.vectorFeaturesTree[temp[1]+".kmz"] != "undefined" ? ".kmz" : ".kml");
                var subClassName = convertType.replace("fromData.", "").replace(className+".", "");

                var r = this.getNearDataFromVectorFeaturesTree(className, subClassName, feature);

                if(r == false)  throw new Error("Katmanda data bulunamadı! ("+convertType+")");

                return r; 

            default: return record[columnName];
        }
    }
    
    getNearDataFromVectorFeaturesTree(className, subClassName, feature)
    {
        var source = this.vectorFeaturesTree[className]['data'][subClassName]["data"];
        var keys = Object.keys(source);

        var centerFeature = MapHelper.getCenterFeatureFromFeature(feature);
        var centerCords = centerFeature.getGeometry().getCoordinates();

        var nearFeature = null;
        var minDistance = Number.MAX_SAFE_INTEGER;

        for(var i = 0; i < keys.length; i++)
        {
            var key = keys[i];

             for(var j = 0; j < source[key]["data"].length; j++)
            {
                var temp = MapHelper.getCenterFeatureFromFeature(source[key]["data"][j]);
                var coords = temp.getGeometry().getCoordinates()
                
                var x = centerCords[0] - coords[0];
                if(x < 0) x = -1 * x;
                
                var y = centerCords[1] - coords[1];
                if(y < 0) y = -1 * y;
                
                var distance = Math.sqrt(x*x+y*y);

                if(distance < minDistance)
                {
                    minDistance = distance;
                    nearFeature = source[key]["data"][j];
                }                
            }
        }

        if(nearFeature == null) return false;

        return nearFeature.featureObject.name;
    }
    
    
    
    /****    Common Functions    ****/
    
    nullTableAuth()
    {
        this.messageHelper.sweetAlert("Arama yapmak için bir hiç bir tablo yetkiniz yok!", "Hata", "error");
    }
}