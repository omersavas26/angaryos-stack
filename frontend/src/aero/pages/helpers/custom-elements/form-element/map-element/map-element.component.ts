import { Component, EventEmitter, Input, Output } from '@angular/core';

import { BaseHelper } from './../../../base';
import { MapHelper } from './../../../map';
import { MessageHelper } from './../../../message';
import { SessionHelper } from './../../../session';
import { GeneralHelper } from './../../../general';

declare var $: any;

@Component(
{
    selector: 'map-element',
    styleUrls: ['./map-element.component.scss'],
    templateUrl: './map-element.component.html'
})
export class MapElementComponent
{
    @Input() defaultData: string;
    @Input() value: string;
    @Input() type: string;
    @Input() name: string;
    @Input() columnName: string;
    @Input() placeholder: string;
    @Input() showFilterTypesSelect: boolean;
    @Input() multiple: boolean;
    @Input() filterType: string;  
    @Input() srid: string = "";
    @Input() upFormId: string = "";
    @Input() createForm: boolean = false;
    

    featuresPanelVisible = false;
    features = [];
    selectedFeature = null;
    selectedFeatureGeoJson = null;
    map = null;
    geoJsonObject = null;
    baseElementSelector = "";
    geoColumns = 
    {
        'point': 'Nokta',
        'linestring': 'Çizgi',
        'polygon': 'Alan',
        'multipoint': 'Nokta(lar)',
        'multilinestring': 'Çizgi(ler)',
        'multipolygon': 'Alan(lar)',
    }

    @Output() changed = new EventEmitter();
    @Output() dataChanged = new EventEmitter();

    constructor(
        private messageHelper: MessageHelper, 
        private sessionHelper: SessionHelper,
        private generalHelper: GeneralHelper
    ) { }

    

    /****    Map Functions    ****/

    ngAfterViewInit()
    {
        if(this.upFormId.length > 0)
            this.baseElementSelector = '#'+this.upFormId+'inFormModal ';
            
        setTimeout(() =>
        {
            this.addKmzFileChangedEvent();
            
        }, 200);
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
            $('#kmzFile').val("");
            this.generalHelper.stopLoading();
            
            if(data == null) this.messageHelper.sweetAlert("Beklenmedik cevap geldi!", "Hata", "warning");
            else this.addFeaturesFromKmzOrKmlFile(data);
                
        })
        .catch((e) => 
        { 
            $('#kmzFile').val("");
            this.generalHelper.stopLoading();
        });
    }
    
    addFeaturesFromKmzOrKmlFile(data)
    {
        var features = [];
        
        var layers = Object.keys(data);
        for(var i = 0; i < layers.length; i++)
        {
            var layerName = layers[i];
            var layerData = data[layerName];
            if(typeof layerData[this.type.replace('multi', '')] == "undefined") continue;
            
            features = features.concat(layerData[this.type.replace('multi', '')]);
        }
        
        if(features.length == 0) this.messageHelper.toastMessage("Aranan tipte nesne bulunamadı!");
        else if(this.multiple)
        {
            var temp = [];
            for(var i = 0; i < features.length; i++)
                temp.push(MapHelper.getFeatureFromWkt(features[i]['wkt'], "EPSG:4326"));
            
            MapHelper.addFeatures(this.map, temp);
            MapHelper.zoomToFeatures(this.map, temp);
        }
        else if(features.length > 1) this.messageHelper.toastMessage("Bu kolona birden fazla nesne ekleyemezsiniz!");
        else
        {
            MapHelper.clearAllFeatures(this.map);
            MapHelper.addFeatureByWkt(this.map, features[0]['wkt'], "EPSG:4326");
        }
    }

    openMapElement()
    {
        this.showModal()
        .then(() => this.createMapElement())
        .then((map) => this.changeBaseMap(map))
        .then((map) => this.addDrawing(map))
        .then((map) => this.addFeaturesFromValue(map))
        .then((map) => this.emitDataChangedEvent())
    }

    showModal()
    {
        return new Promise((resolve) =>
        {
            $(this.baseElementSelector+' #'+this.name+'MapElementModal').modal('show').on('shown.bs.modal', () => 
            {
                resolve(true);                
            });
        });
    }

    createMapElement()
    {
        return MapHelper.createFormElementMap(this.name+'MapElement').then((map) =>
        {
            this.map = map;
            return map;
        });
    }

    changeBaseMap(map)
    {
        var layers = MapHelper.getBaseLayersFromMap(map);
        for(var i = 0; i < layers.length; i++)
            layers[i].setVisible(layers[i]['name'] == 'bing_aerialwithlabelsondemand');

        return map;
    }

    addDrawing(map)
    {
        var type = BaseHelper.ucfirst(this.type.replace("multi", ""));
        if(type == "Linestring") type = "LineString";
        
        MapHelper.addDraw(map, type, this.multiple)
        MapHelper.addModify(map, this.multiple)
        MapHelper.addSnap(map);
        
        map.addEventListener(   'dataChanged', 
                                (e) => this.emitDataChangedEvent(), 
                                true);

        return map;
    }

    addFeaturesFromValue(map)
    {
        if(this.value == "") return map;

        if(this.value.substr(0, 2) != '["') 
            this.value = '["' + this.value + '"]';

        var srid = null;
        if(this.srid.length > 0)
            srid = "EPSG:"+this.srid;

        var wkts = BaseHelper.jsonStrToObject(this.value);
        for(var i = 0; i < wkts.length; i++)
            if(wkts[i] != '[]')
                MapHelper.addFeatureByWktAsSingleIfMulti(map, wkts[i], srid);

        return map;
    }

    selectFeature(feature)
    {
        this.selectedFeature = feature;
        this.selectedFeatureGeoJson = BaseHelper.objectToJsonStr(MapHelper.getFeatureGeoJsonObject(feature));
        
        MapHelper.selectFeature(this.map, feature, true)
    }

    deleteFeature(feature)
    {
        MapHelper.deleteFeature(this.map, feature);
        this.emitDataChangedEvent();
    }
    
    addNetcadFeatures()
    {   
        setTimeout(() => $(document).off('focusin.modal'), 500);
             
        this.messageHelper.swalPrompt("Netcad nokta dizisi:", "Tamam", "İptal", "textarea")
        .then((data) =>
        {
            if(typeof data["value"] == "undefined") return;
                
            var wkt = MapHelper.getWktFromNetcad(data['value'], this.type.toLowerCase().replace('multi', ''));   

            var feature = MapHelper.getFeatureFromWkt(wkt, MapHelper.userProjection);
            MapHelper.addFeatures(this.map, [feature]);
            MapHelper.zoomToFeature(this.map, feature);
            
            if(!this.multiple) 
            {
                MapHelper.showNoMultipleConfirm(this.map)
                .then(() => this.emitDataChangedEvent());
            }
        });
    }
    
    kmzAuthControl()
    {
        return this.sessionHelper.kmzAuthControl();
    }
    
    isMobileDevice()
    {
        return BaseHelper.isMobileDevice;
    }
    
    selectKmzFile()
    {
        $('#kmzFile').click();
    }
    
    clearValue($event)
    {
        this.value = "";
        setTimeout(() => this.handleChange(event), 200);
    }



    /****    Gui Functions    ****/

    getDescription()
    {
        if(this.value == null) return this.placeholder;
        if(this.value.length == 0) return this.placeholder;

        return this.geoColumns[this.type];
    }   

    getStyle()
    {
        if(this.value == null) return {color: '#999'};
        if(this.value.length == 0) return {color: '#999'};

        return  {color: '#495057'};
    }

    getTransformedCoords(coords)
    {
        return MapHelper.transformCoorditanes(coords);
    }
    
    getFeatures()
    {
        var tempFeatures = [];
        
        var temp = MapHelper.getAllFeatures(this.map);
        for(var i = 0; i < temp.length; i++)
        {
            var feature = temp[i];
            feature['typeName'] = feature.getGeometry().getType();
            tempFeatures[feature['ol_uid']] = feature;
        }
        
        var fs = [];
        for(var i = 0; i < tempFeatures.length; i++)
            if(typeof tempFeatures[i] != "undefined")
                fs.push(tempFeatures[i]);
        
        return fs;
    }
    
    



    /****    Event Functions    ****/

    emitDataChangedEvent()
    {
        this.geoJsonObject = MapHelper.getAllFeaturesAsGeoJsonObject(this.map).features;
        this.dataChanged.emit(this.geoJsonObject);
        
        this.features = this.getFeatures();
    }

    emitChangedEvent()
    {
        var srid = null;
        if(this.srid.length > 0)
            srid = "EPSG:"+this.srid;

        var wkt = MapHelper.getAllFeaturesAsWkt(this.map, srid);
        var json = BaseHelper.objectToJsonStr(wkt);
        this.value = json
        $(this.baseElementSelector+' #'+this.name).val(json);

        const changeEvent = document.createEvent('Event');  
        changeEvent.initEvent('change', true, true);
        $(this.baseElementSelector+' #'+this.name)[0].dispatchEvent(changeEvent);
        
        $(this.baseElementSelector+' #'+this.name+'MapElementModal').modal('hide');
        
        
    }

    handleChange(event)
    {
        this.changed.emit(event);
    }  
    
    changeFeaturesPanelVisible(visible)
    {
        this.featuresPanelVisible = visible;
    } 
}