// @ts-nocheck

import Map from 'ol/Map';
import View from 'ol/View';

import Feature from 'ol/Feature';

import { WKT, GeoJSON} from 'ol/format';

import {Image as ImageLayer, Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import TileWMS from 'ol/source/TileWMS';
import ImageWMS from 'ol/source/ImageWMS';

import { OSM, Vector as VectorSource } from 'ol/source';
import BingMaps from 'ol/source/BingMaps';

import {Draw, Modify, Snap} from 'ol/interaction';

import { Circle as CircleStyle, Fill, Stroke, Style, Icon, Text } from 'ol/style';

import {Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon} from 'ol/geom';

import {defaults as defaultControls} from 'ol/control';
import MousePosition from 'ol/control/MousePosition';
import {createStringXY} from 'ol/coordinate';

import {bbox as bboxStrategy} from 'ol/loadingstrategy';
import { transform as transformProjection } from 'ol/proj';

import {register} from 'ol/proj/proj4';
import proj4 from 'proj4';

import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

import { BaseHelper } from './base';

declare var $: any;

export abstract class MapHelper 
{   
  public static dbProjection = 'EPSG:7932';
  public static mapProjection = 'EPSG:3857';
  public static userProjection = ""
  public static customProjectionAdded = false;
  public static styleApplying = {};
  public static drawingFeatures = {};
  public static escKeyListening = false;



  /****    Map Object Functions     ****/

  public static addCustomProjections()
  {
    if(this.customProjectionAdded) return;

    this.userProjection = 'EPSG:'+BaseHelper.loggedInUserInfo.user.srid;
    if(this.userProjection == null) this.userProjection = "EPSG:7932";

    proj4.defs('EPSG:7932', '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
    register(proj4);

    this.customProjectionAdded = true;
  }

  public static createFullScreenMap(mapId)
  {
    var task = this.mapFactory(mapId);
    return task;
  }

  public static createFormElementMap(mapId)
  {
    var task = this.mapFactory(mapId, true);
    return task;
  }

  public static createPreviewMap(mapId)
  {
    var task = this.mapFactory(mapId, true);
    return task;
  }

  public static mapFactory(mapId, modal = false)
  {
    if(modal)
    {
      var h = window.innerHeight;
      $('#'+mapId).css('height', (h*0.9)+"px");
      $('#'+mapId).css('min-height', (h*0.9)+"px");
    }

    var task = new Promise((resolve) =>
    {
      $('#'+mapId).html("");
      $('.custom-mouse-position').html("");
      resolve(this.getMap(mapId));
    })
    .then((map: Map) =>
    {
      $('.ol-attribution').remove();
      map.setTarget(map.getTarget());
      map.updateSize(); 

      return map;
    });

    return task;
  }

  public static getBaseLayersBing()
  {
    var styles = 
    [
        'RoadOnDemand',
        'Aerial',
        'AerialWithLabelsOnDemand',
        'CanvasDark',
        'OrdnanceSurvey'
    ];
      
    var layers = [];
    for (var i = 0; i < styles.length; ++i) 
    {
      var layer = new TileLayer(
      {
        visible: false,
        preload: Infinity,
        source: new BingMaps(
        {
          key: 'AjVFELuOInhDWUKz3aMKA7crfg4SJ7W0x04FLscmgpo5cU98ntGNdK10reh4YGT7',
          imagerySet: styles[i]
        })
      });

      layer['name'] = "bing_"+styles[i].toLowerCase();
      layer['display_name'] = styles[i];
      layer['base_layer'] = true;

      layers.push(layer);
    }

    return layers;
  }

  public static getBaseLayers(config = null)
  {
    var osmLayer = new TileLayer({ source: new OSM() });
    osmLayer['name'] = 'osm';
    osmLayer['display_name'] = 'Open Street Map';
    osmLayer['base_layer'] = true;

    var bingLayers = this.getBaseLayersBing();
    
    var baseLayers = [osmLayer].concat(bingLayers);

    if(config != null)
      baseLayers = this.updateBaseLayerVisibility(baseLayers, config);

    return baseLayers;
  }

  public static getNewVectorLayer()
  {
    var vector = new VectorLayer(
    {
      source: new VectorSource({features: []})
    });
    vector['name'] = "vector";
    vector['display_name'] = "vector";

    return vector;
  }

  public static getNewView(config)
  {
    var view = new View(
    {
      projection: this.mapProjection,
      center: config.center,
      zoom: config.zoom
    });

    return view;
  }

  public static getNewMousePositionControl(mapId)
  {
    var control = new MousePosition(
    {
      coordinateFormat: createStringXY(4),
      projection: 'EPSG:'+BaseHelper.loggedInUserInfo.user.srid,
      className: 'custom-mouse-position',
      target: document.getElementById('mouse-position-'+mapId)
    });

    return control;
  }

  public static getMap(mapId, params = {})
  {
    var config = this.getMapConfig(mapId);
    
    this.addCustomProjections();

    var baseLayers = this.getBaseLayers(config);
    var vector = this.getNewVectorLayer();
    var layers = baseLayers.concat([vector]);

    var view = this.getNewView(config);
    var mousePositionControl = this.getNewMousePositionControl(mapId);

    var map = new Map(
    {
      target: mapId,
      layers: layers,
      view: view,
      controls: defaultControls().extend([mousePositionControl]),
    });

    map.on('moveend', (event) =>
    {
      this.updateMapConfigOnLocal(event.map);
    });

    return map;
  }

  public static getMapConfig(mapId)
  {
    var config = 
    {
      zoom: 8,
      center: [3306283.2208494954, 4772491.014747706]
    }

    var temp = BaseHelper.readFromLocal('map.'+mapId+'.config');
    if(temp != null) config = temp;

    return config;
  }



  /****   Operations    ****/

  public static addDraw(map, type, multiple, freehand = false)
  {
    return new Promise((resolve) =>
    {
      var opt = 
      {
        source: this.getVectorSource(map),
        type: type
      };
      
      if(freehand && type == "LineString")
        opt['freehand'] = true;
      
      var draw = new Draw(opt);

      draw['multiple'] = multiple;
      
      draw.on('drawstart', (e) => 
      {
        this.drawingFeatures[map.getTarget()] = e.feature;
      });
      
      draw.on('drawend', (e) => 
      {
        this.featuresChanged(map, multiple, e);
        this.drawingFeatures[map.getTarget()] = null;
      });

      var th = this;

      if(type != "Point" && !this.escKeyListening)
      {
        this.escKeyListening = true;

        $(document).on('keyup', function(e)
        {
          if(e.key != "Escape") return;
          
          var ins = map.getInteractions().getArray();
          for(var i = 0; i < ins.length; i++)
            if(ins[i].constructor.name == "Draw")
                ins[i].set('escKey', Math.random());
        });
      }

      draw.on('change:escKey', (e) => 
      {
        draw.removeLastPoint();
      });
      
      

      map.addInteraction(draw);

      resolve(draw);
    });     
  }

  public static removeInteraction(map, interaction)
  {
    return new Promise((resolve) =>
    {
      map.removeInteraction(interaction);
      interaction.dispose();
      resolve(map);
    });     
  }

  public static addModify(map, multiple)
  {
    return new Promise((resolve) =>
    {
      var modify = new Modify(
      {
        source: this.getVectorSource(map)
      });
      modify.on('modifyend',(e) => this.featuresChanged(map, multiple, e));

      map.addInteraction(modify);

      resolve(modify);
    });     
  }

  public static addSnap(map)
  {
    return new Promise((resolve) =>
    {
      var snap = new Snap(
      {
        source: this.getVectorSource(map)
      });
      map.addInteraction(snap);

      resolve(snap);
    });    
  }

  public static getLayerFromMapAuth(map, tableAuth)
  {
    switch (tableAuth['type'].split(":")[0]) 
    {
      case 'wms':
        return this.getLayerFromMapAuthWms(map, tableAuth);
      case 'wfs':
        return this.getLayerFromMapAuthWfs(map, tableAuth);

      default: console.log("Undefined layer type: " + tableAuth['type']);
    }
  }

  public static fillMapObectsInThisObjectForStyle()
  {
    if(typeof this['Style'] != 'undefined') return;

    this['Style'] = Style;
    this['Icon'] = Icon;
    this['Text'] = Text;
    this['Fill'] = Fill;
    this['Stroke'] = Stroke;
    this['CircleStyle'] = CircleStyle;
  }

  public static getStyleCodeForEval(code)
  {
    code = BaseHelper.replaceAll(code, " CircleStyle(", " th.CircleStyle(");
    code = BaseHelper.replaceAll(code, " Style(", " th.Style(");
    code = BaseHelper.replaceAll(code, " Icon(", " th.Icon(");
    code = BaseHelper.replaceAll(code, " Text(", " th.Text(");
    code = BaseHelper.replaceAll(code, " Fill(", " th.Fill(");
    code = BaseHelper.replaceAll(code, " Stroke(", " th.Stroke(");

    return code;
  }

  public static removeSameFeaturesOnVectorSource(vectorSource, columnName = 'id')
  {
    var features = vectorSource.getFeatures();
    var tempArray = {};
    
    for(var i = features.length - 1; i >= 0; i--)
    {
      var feature = features[i];
      var id = feature.values_[columnName];

      if(typeof tempArray[id] == "undefined") tempArray[id] = [];

      tempArray[id].push(feature);
    }

    vectorSource.clear();
    var ids = Object.keys(tempArray);

    for(var i = 0; i < ids.length; i++)
    {
      var t = tempArray[ids[i]];
      var order = 0;
      
      if(t.length > 1)
        if(t[1].revision_ > t[0].revision_) 
          order = 1;

      vectorSource.addFeature(t[order]);
    }
  }

  public static getLayerFromMapAuthWfs(map, tableAuth)
  {
    var url = tableAuth["base_url"];
    if(url == "") url = BaseHelper["pipe"]["geoserverBaseUrl"];

    var tempProjection = this.mapProjection;
    url =   url +
            '?service=WFS&' +
            'version=1.1.0&request=GetFeature&typename='+tableAuth["workspace"]+':'+tableAuth["layer_name"]+'&' +
            'outputFormat=application/json&srsname='+tempProjection+'&' + 'bbox=';

    var vectorSource = new VectorSource(
    {
      format: new GeoJSON(),
      url: function(extent) 
      {
        return url + extent.join(',') + ','+tempProjection;
      },
      strategy: bboxStrategy
    });

    var layer = new VectorLayer({ source: vectorSource });

    this.addEventListenersOnVectorSource(map, vectorSource, tableAuth);
    
    layer['name'] = tableAuth["workspace"]+'__'+tableAuth["layer_name"];

    var keys = Object.keys(tableAuth);
    for(var i = 0; i < keys.length; i++) layer[keys[i]] = tableAuth[keys[i]];

    return layer;
  }

  public static getLayerFromMapAuthWms(map, tableAuth)
  {
    if(tableAuth['type'] == "wms") return this.getLayerFromMapAuthWmsTiled(map, tableAuth);
    else if(tableAuth['type'] == "wms:singleTile") return this.getLayerFromMapAuthWmsSingleTile(map, tableAuth);
    else console.log("Undefined WMS type");
  }

  public static getLayerFromMapAuthWmsSingleTile(map, tableAuth)
  {
    var url = tableAuth["base_url"];
    if(url == "") url = BaseHelper["pipe"]["geoserverBaseUrl"];

    var params = 
    {
      'LAYERS': tableAuth["workspace"]+':'+tableAuth["layer_name"],
      'STYLES': tableAuth["style"]
    };

    var layer = new ImageLayer(
    {
      source: new ImageWMS(
      {
        url: url,
        params: params,
        ratio: 1,
        serverType: 'geoserver'
      })
    });

    layer['name'] = tableAuth["workspace"]+'__'+tableAuth["layer_name"];
    
    var keys = Object.keys(tableAuth);
    for(var i = 0; i < keys.length; i++) layer[keys[i]] = tableAuth[keys[i]];

    return layer;
  }

  public static getLayerFromMapAuthWmsTiled(map, tableAuth)
  {
    var url = tableAuth["base_url"];
    if(url == "") url = BaseHelper["pipe"]["geoserverBaseUrl"];

    var params = 
    {
      'LAYERS': tableAuth["workspace"]+':'+tableAuth["layer_name"],
      'TILED': true,
      'STYLES': tableAuth["style"]
    };

    var layer = new TileLayer(
    {
      source: new TileWMS(
      {
        url: url,
        params: params,
        serverType: 'geoserver',
        transition: 0
      })
    });

    layer['name'] = tableAuth["workspace"]+'__'+tableAuth["layer_name"];
    
    var keys = Object.keys(tableAuth);
    for(var i = 0; i < keys.length; i++) layer[keys[i]] = tableAuth[keys[i]];

    return layer;
  }

  public static orderLayers(map, layerAuths)
  {
    var config = this.getMapConfig(map.getTarget());
    if(typeof config['layerInfos'] == "undefined") return layerAuths;

    var tableNames = Object.keys(layerAuths);    
    var layerNames = Object.keys(config['layerInfos']);

    var orderedLayers = {};

    for(var i = 0; i < layerNames.length; i++)
      if(typeof layerAuths[layerNames[i]] != "undefined")
      {
        orderedLayers[layerNames[i]] = layerAuths[layerNames[i]];

        for(var j = 0; j < tableNames.length; j++)
          if(tableNames[j] == layerNames[i])
          {
            tableNames.splice(j, 1);
            break;
          }
        
      }

    for(var i = 0; i < tableNames.length; i++)
      orderedLayers[tableNames[i]] = layerAuths[tableNames[i]];

    return orderedLayers;
  }

  public static getLayerVisibilityFromConfig(map, layer)
  {
    var config = this.getMapConfig(map.getTarget());

    if(typeof config['layerInfos'] == "undefined") return true;
    if(typeof config['layerInfos'][layer['name']] == "undefined") return true;
    if(typeof config['layerInfos'][layer['name']]['visible'] == "undefined") return true;

    return config['layerInfos'][layer['name']]['visible'];
  }

  public static addLayersFromMapAuth(map, layerAuths)
  {
    return new Promise((resolve) =>
    {
      layerAuths = this.orderLayers(map, layerAuths);
      var tableNames = Object.keys(layerAuths);

      for(var i = 0; i < tableNames.length; i++)
      {
        var tableName = tableNames[i];
        var auth = layerAuths[tableName];

        var layer = this.getLayerFromMapAuth(map, auth);
        if(layer == null) continue;

        layer['authData'] = auth;

        var vs = false;
        if(auth['layerAuth']) vs = this.getLayerVisibilityFromConfig(map, layer);
        layer.setVisible(vs);

        map.addLayer(layer);
      }

      resolve(map);
    });    
  }

  public static getBaseLayersFromMap(map)
  {
    if(map == null) return [];

    var baseLayers = [];

    var layers = map.getLayers().array_;
    for(var i = 0; i < layers.length; i++)
        if(typeof layers[i]['base_layer'] != "undefined")
            if(layers[i]['base_layer'])
                baseLayers.push(layers[i]);

    return baseLayers;
  }

  public static getLayersFromMap(map)
  {
    if(map == null) return [];

    var layers = map.getLayers().array_;
    return layers;
  }

  public static getLayersFromMapWithoutBaseLayers(map)
  {
    if(map == null) return [];

    var layers = [];

    var allLayers = map.getLayers().array_;
    for(var i = 0; i < allLayers.length; i++)
      if(typeof allLayers[i]['base_layer'] == "undefined")
        if(allLayers[i]['name'] != 'vector')
          layers.push(allLayers[i]);

    return layers;
  }

  public static changeBaseLayer(map, layerIndex)
  {
    var layers = map.getLayers().array_;
    for(var i = 0; i < layers.length; i++)
        if(typeof layers[i]['base_layer'] != "undefined")
            if(layers[i]['base_layer'])
              layers[i].setVisible(i == layerIndex);

      this.updateMapConfigOnLocal(map);
  }

  public static updateBaseLayerVisibility(baseLayers, config)
  {
    if(typeof config['layerInfos'] != "undefined")
      for(var i = 0; i < baseLayers.length; i++)
      {
        if(typeof config.layerInfos[baseLayers[i]["name"]] == "undefined")
          continue;

        var v = config.layerInfos[baseLayers[i]["name"]].visible;
        baseLayers[i].setVisible(v);
      }

    return baseLayers;
  }

  public static getLayerIndex(map, layer)
  {
    var layers = this.getLayersFromMap(map);
    for(var i = 0; i < layers.length; i++)
      if(layer['name'] == layers[i]['name'])
        return i;

      return -1;
  }

  public static moveLayer(map, layer, diff)
  {
    var index = this.getLayerIndex(map, layer);
    if(index == -1)
      index = this.getLayersFromMap(map).length;
    else
      index = index + diff;

    map.removeLayer(layer);
    map.getLayers().insertAt(index, layer);

    this.updateMapConfigOnLocal(map);
  }

  public static changeLayerVisibility(map, layer)
  {
        layer.setVisible(!layer.getVisible());
        this.updateMapConfigOnLocal(map);
  }

  public static zoom(map, direction)
  {
    var temp = 1;
    if(!direction) temp = -1;

    map.getView().animate(
    {
      zoom: map.getView().getZoom() + temp
    });
  }

  public static getFeaturesAtPixel(map, pixel)
  {
    return new Promise(async (resolve) =>
    {
      var data = {};

      var i = 0;
      await map.forEachFeatureAtPixel(pixel, function (feature, layer) 
      {
        var layerName = "layer"+(i++);
        if(layer != null)
          if(typeof layer['name'] != "undefined")
            layerName = layer.name;

        if(typeof data[layerName] == "undefined")
          data[layerName] = [];

        data[layerName].push(feature);
      });

      resolve(data);
    });
  }



  /****    Events     ****/

  public static emitDataChangedEvent(map, e)
  {
    e.type = 'dataChanged';
    map.dispatchEvent(e);
  }

  public static updateMapConfigOnLocal(map) 
  {
    var name = map.getTarget();
    var center = map.getView().getCenter();
    var zoom = map.getView().getZoom();

    var layerInfos = {};    
    var layers = this.getLayersFromMap(map);
    for(var i = 0; i < layers.length; i++)
      layerInfos[layers[i]['name']] =
      {
        'name': layers[i]['name'],
        'display_name': layers[i]['display_name'],
        'visible': layers[i].getVisible()
      };

    var config = 
    {
      zoom: zoom,
      center: center,
      layerInfos: layerInfos
    }

    BaseHelper.writeToLocal('map.'+name+'.config', config);
  }

  public static addEventListenersOnVectorSource(map, vectorSource, tableAuth)
  {
    this.fillMapObectsInThisObjectForStyle();
    this.addEventListenersOnVectorSourceForStyle(map, vectorSource, tableAuth);
    this.addEventListenersOnVectorSourceForRefresh(map, vectorSource, tableAuth)
  }

  public static addEventListenersOnVectorSourceForStyle(map, vectorSource, tableAuth)
  {
    var layerKey = tableAuth["workspace"]+'_'+tableAuth["layer_name"];
    this.styleApplying[layerKey] = false;

    var th = this;
    var listenerKey = vectorSource.on('change', function(e) 
    {
      if(th.styleApplying[layerKey]) return;
      th.styleApplying[layerKey] = true;

      th.removeSameFeaturesOnVectorSource(vectorSource);

      var features = vectorSource.getFeatures();
      for(var i = 0; i < features.length; i++)
      {
        var style = null;
        
        var feature = features[i].values_;

        var code = th.getStyleCodeForEval(tableAuth["style"]);        
        eval(code);

        if(typeof style == "undefined" || style == null) continue;
        features[i].setStyle(style);
      }

      th.styleApplying[layerKey] = false;

      //console.log(tableAuth["name"] + ": " + vectorSource.getFeatures().length);
    });    
  }

  public static addEventListenersOnVectorSourceForRefresh(map, vectorSource, tableAuth)
  {
    if(tableAuth["period"] == 0) return;

    setInterval(() => 
    {
      if(window.location.href.indexOf('/map') == -1) return;
      vectorSource.refresh();
    }, 
    tableAuth["period"] * 1000);
  }



  /****    Features Functions    ****/

  public static featuresChanged(map, multiple, e)
  {
    setTimeout(() => 
    {
      if(this.getAllFeatures(map).length < 2) 
      {
        this.emitDataChangedEvent(map, e);
        return;
      }

      if(!multiple)
        this.showNoMultipleConfirm(map, e);
      else
        this.emitDataChangedEvent(map, e);
        
    }, 100);

    return true;
  }

  public static getFeatureFromWkt(wkt, dataProjection = 'EPSG:4326', featureProjection = null)
  {
    if(featureProjection == null) 
      featureProjection = this.mapProjection;

    var format = new WKT();

    var feature = format.readFeature(wkt, 
    {
      dataProjection: dataProjection,
      featureProjection: featureProjection
    });

    var type = wkt.split('(')[0].toLowerCase();
    type = BaseHelper.ucfirst(type);

    feature.setStyle(this.getDefaultStyle(type));
    return feature;
  }
  
  public static getFeatureFromGeometry(geom)
  {
    return new Feature({ geometry: geom });
  }
  
  public static getFeatureFromGeoserverJsonResponseGeometry(geoServerGeometry)
  {
      var geom = null;
      
      switch(geoServerGeometry['type'])
      {
        case 'Point': 
          geom = new Point(geoServerGeometry['coordinates']);
          break;
        case 'MultiPoint': 
          geom = new MultiPoint(geoServerGeometry['coordinates']);
          break;
        case 'Linestring': 
          geom = new LineString(geoServerGeometry['coordinates']);
          break;
        case 'MultiLineString': 
          geom = new MultiLineString(geoServerGeometry['coordinates']);
          break;
        case 'Polygon': 
          geom = new Polygon(geoServerGeometry['coordinates']);
          break;
        case 'MultiPolygon': 
          geom = new MultiPolygon(geoServerGeometry['coordinates']);
          break;
        default:
            console.log('getFeatureFromGeoserverJsonResponseGeometry: ' + geoServerGeometry['type']);
            return null;
      }
      
      return this.getFeatureFromGeometry(geom);
  }
  
  public static getPolygonFromPoint(pointFeature, radius)
  {
    radius = radius / 2;
    
    var poitnExtent = pointFeature.getGeometry().getExtent();
    var bufferedExtent = 
    [
        poitnExtent[0]-radius,
        poitnExtent[1]-radius,
        poitnExtent[2]+radius,
        poitnExtent[3]+radius
    ];
    
    
    return new Polygon(
    [
        [
            [bufferedExtent[0], bufferedExtent[1]],
            [bufferedExtent[0], bufferedExtent[3]],
            [bufferedExtent[2], bufferedExtent[3]],
            [bufferedExtent[2], bufferedExtent[1]],
            [bufferedExtent[0], bufferedExtent[1]]
        ]
    ]);
  }
  
  public static getWktFromFeature(feature, sourceProjection = null, targetProjection = null)
  {
    if(sourceProjection == null) sourceProjection = this.mapProjection;
    if(targetProjection == null) targetProjection = this.userProjection;

    var format = new WKT();

    feature.getGeometry().transform(sourceProjection, targetProjection);
    var wkt = format.writeGeometry(feature.getGeometry());
    feature.getGeometry().transform(targetProjection, sourceProjection);
    
    return wkt;
  }

  public static getVectorLayer(map)
  {
    var layers = map.getLayers().array_;
    for(var i = 0; i < layers.length; i++)
        if(map.getLayers().array_[i] instanceof VectorLayer)
          return map.getLayers().array_[i];
  }

  public static getVectorSource(map)
  {
    var vectorLayer = this.getVectorLayer(map);
    return vectorLayer.getSource();
  }

  public static clearAllFeatures(map)
  {
    this.getVectorSource(map).clear();
  }
  
  public static deleteFeature(map, indexOrFeature)
  {
    var source = this.getVectorSource(map);
    
    var feature = indexOrFeature;
    if($.isNumeric(indexOrFeature))
        feature = source.getFeatures()[indexOrFeature];
        
    source.removeFeature(feature);
  }

  public static selectFeature(map, indexOrFeature, onlyOneFeature = true)
  {
    var source = this.getVectorSource(map);
    var features = source.getFeatures();

    if(onlyOneFeature)
      for(var i = 0; i < features.length; i++)
      {
        var type = features[i].getGeometry().getType();
        var style = this.getDefaultStyle(type);
        features[i].setStyle(style);
      }
      
    var feature = indexOrFeature;
    if($.isNumeric(indexOrFeature))
        feature = features[indexOrFeature];
    
    var type = feature.getGeometry().getType();
    var style = this.getSelectedStyle(type);
    feature.setStyle(style);
  }

  public static getAllFeaturesAsGeoJsonObject(map)
  {
    var writer = new GeoJSON();
    var source = this.getVectorSource(map);
    var json = writer.writeFeatures(source.getFeatures());

    return BaseHelper.jsonStrToObject(json);
  }
  
  public static getFeatureGeoJsonObject(feature)
  {
    var writer = new GeoJSON();
    
    var json = writer.writeFeatures([feature]);

    return BaseHelper.jsonStrToObject(json);
  }

  public static getAllFeaturesAsWkt(map, targetProjection = null)
  {
    var sourceProjection = this.mapProjection;
    if(targetProjection == null) targetProjection = this.userProjection;

    var format = new WKT();

    var source = this.getVectorSource(map);
    var features = source.getFeatures();
    
    var wkts = [];
    for(var i = 0; i < features.length; i++)
    {
      features[i].getGeometry().transform(sourceProjection, targetProjection);
      wkts.push(format.writeGeometry(features[i].getGeometry()));
      features[i].getGeometry().transform(targetProjection, sourceProjection);
    }

    return wkts;
  }

  public static getAllFeatures(map)
  {
    return this.getVectorSource(map).getFeatures();
  }

  public static zoomToFeatures(map, features)
  {
    return new Promise((resolve) =>
    {
      var extent = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0, 0];
      
      for(var i = 0; i < features.length; i++)
      {
        var feature = features[i];
        var temp = feature.getGeometry().getExtent();

        if(temp[0] < extent[0]) extent[0] = temp[0];
        if(temp[1] < extent[1]) extent[1] = temp[1];
        if(temp[2] > extent[2]) extent[2] = temp[2];
        if(temp[3] > extent[3]) extent[3] = temp[3];
      }

      map.getView().fit(extent, map.getSize()); 
      map.getView().setZoom(map.getView().getZoom()-1); 
    
      if(map.getView().getZoom() > 18)
      map.getView().setZoom(18);
      resolve(extent);
    });
    
    
    
      
  }

  public static zoomToFeature(map, feature)
  {
    var extent = feature.getGeometry().getExtent();
    
    map.getView().fit(extent, map.getSize()); 
    map.getView().setZoom(map.getView().getZoom()-1); 
    
    if(map.getView().getZoom() > 18)
      map.getView().setZoom(18);
      
  }
  
  public static addFeatureByWktAsSingleIfMulti(map, wkt, projection = null)
  {
    if(wkt.toLowerCase().indexOf("multi") > -1) 
    {
        var type = wkt.toLowerCase().split("(")[0].replace('multi', '');
        var temp = wkt.toLowerCase().replace('multi'+type, '').split("(");
                
        for(var i = 0; i < temp.length; i++)
        {
            temp[i] = temp[i].replaceAll("),", "");
            temp[i] = temp[i].replaceAll(")", "");
            temp[i] = temp[i].trim();
            if(temp[i].length == 0) continue;
            
            switch(type)
            {
                case 'point':
                case 'linestring':
                    temp[i] = type+"("+temp[i]+")";
                    break;
                case 'polygon':
                    temp[i] = type+"(("+temp[i]+"))";
                    break;
            }
            
            temp[i] = temp[i].toUpperCase();
            this.addFeatureByWkt(map, temp[i], projection);
        }
        
        this.zoomToFeatures(map, this.getAllFeatures(map));
    }
    else this.addFeatureByWkt(map, wkt, projection);
    
  }

  public static addFeatureByWkt(map, wkt, projection = null)
  {
    if(projection == null) projection = this.userProjection;
    
    return new Promise((resolve) =>
    {
      var feature = this.getFeatureFromWkt(wkt, projection);

      this.getVectorSource(map).addFeature(feature);

      this.zoomToFeature(map, feature);

      resolve(feature);
    }); 
  }

  public static addFeatures(map, features)
  {
    return new Promise((resolve) =>
    {
      this.getVectorSource(map).addFeatures(features);
      resolve(features);
    }); 
  }




  /****    Common Functions    ****/
  
  public static getBufferSizeByMapZoom(map)
  {
      var sizes = { 8: 5000, 9: 2500, 10: 1500, 11: 800, 12: 500, 13: 200, 14: 100, 15: 35, 16: 20, 17: 10, 18: 5, 19: 3}; 
      var zoom = map.getView().getZoom();
      
      if(zoom >= 19) return sizes[19];
      if(zoom <= 8) return sizes[8];
      
      return sizes[Math.round(zoom)] * 1;
  }

  public static showNoMultipleConfirm(map, e = null)
  {
      return Swal.fire(
      {
          title: 'Emin misiniz?',
          text: "Bu nesneyi ekleyebilmek için eski nesneler silinecek!",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: "Evet, sil",
          cancelButtonText: "Hayır"
      })
      .then((r) =>
      {
          var features = this.getAllFeatures(map);
          var lastFeature =  features[features.length -1];

          if(r.value)
          {
              this.clearAllFeatures(map);
              this.getVectorSource(map).addFeature(lastFeature);
              if(e != null) this.emitDataChangedEvent(map, e);
          }
          else
              MapHelper.getVectorSource(map).removeFeature(lastFeature);
      });
  }

  public static getWktFromNetcad(data, featureType)
  {
    var wkt = "";   
                
    if(featureType == "polygon") wkt += "POLYGON((";
    else if(featureType == "linestring")  wkt += "LINESTRING(";
    else wkt += "POINT(";

    var firstY, firstX;

    data.split("\n").forEach(function(coord)
    {
        if(coord.substr(0,1) == "Y") return;
        if(coord.length == 0) return;

        var i = 0;
        coord.split("\t").forEach(function(item)
        {
            if(++i >= 3) return;

            while(item.indexOf(" ") > 0)
                item = item.replace(" ","")

            if(!firstY) firstY = item;
            else if(!firstX) firstX = item;

            wkt +=  item + " ";

        });

        wkt = wkt.substr(0, wkt.length-1) + ",";                        
    });

    if(featureType == "polygon") wkt += firstY + " " + firstX + "))";
    else if(featureType == "linestring")  wkt = wkt.substr(0, wkt.length-2) + ")";
    else wkt = wkt.substr(0, wkt.length-2) + ")";
    
    return wkt;
  }
  
  /*public static getTreeFromFeature(id, feature)
  {
    switch(feature.getGeometry().getType())
    {
      case 'Polygon': return this.getTreeFromFeaturePolygon(id, feature);
      default: alert(feature.getGeometry().getType() + " yok"); return "";
    }
  }

  public static getTreeFromFeaturePolygon(id, feature)
  {
    var coords = feature.getGeometry().getCoordinates()[0];

    var html = "<ul>";

    for(var i = 0; i < coords.length; i++)
      html += "<li id='coords-"+id+"-"+i+"'>"+coords[i][0]+" "+coords[i][1]+"</li>"

    html += "</ul>";

    return html;
  }*/

  public static getTextObjectForStyle(text, config = {})
  {
    if(text.length == 0) return null;

    var def =
    {
      fillColor: "blue",
      strokeColor: "#ffffff",
      strokeWidth: 3,
      offsetX: 0,
      offsetY: -20,
      textAlign: "center",
      font: "Arial",
    };

    var keys = Object.keys(def);
    for(var i = 0; i < keys.length; i++)
    {
      var key = keys[i];

      if(typeof config[key] == "undefined") config[key] = def[key];
    }

    config["text"] = text;
    config["fill"] = new Fill({color: config["fillColor"]});
    config["stroke"] = new Stroke({color: config["strokeColor"], width: config["strokeWidth"]});
    
    return new Text(config);
  }

  public static getDefaultStyle(type, text = '')
  {
    switch(type)
    {
      case 'Polygon': return this.getDefaultStylePolygon(text);
      case 'Linestring': return this.getDefaultStyleLinestring(text);
      case 'Point': return this.getDefaultStylePoint(text);
    }
  }

  public static getDefaultStyleLinestring(text = '')
  {
    return new Style(
    {
      stroke: new Stroke(
      {
        color: '#09f',
        width: 2
      }),
      text: this.getTextObjectForStyle(text)
    });
  }

  public static getDefaultStylePolygon(text = '')
  {
    return new Style(
    {
      stroke: new Stroke(
      {
        color: '#09f',
        width: 2
      }),
      fill: new Fill(
      {
        color: '#a4cce6c7'//ex. rgba(0, 0, 255, 0.9)
      }),
      text: this.getTextObjectForStyle(text)
    });
  }

  public static getDefaultStylePoint(text = '')
  {
    return new Style(
    {
      image: new CircleStyle(
      {
        radius: 4,
        fill: new Fill(
        {
          color: '#a4cce6c7'
        }),
        stroke: new Stroke(
        {
          color: '#09f',
          width: 1
        }),
      }),
      text: this.getTextObjectForStyle(text)
    });
  }

  public static getSelectedStyle(type, text = '')
  {
    switch(type)
    {
      case 'Polygon': return this.getSelectedStylePolygon(text);
      case 'Linestring': return this.getSelectedStyleLinestring(text);
      case 'Point': return this.getSelectedStylePoint(text);
    }
  }

  public static getSelectedStyleLinestring(text = '')
  {
    return new Style(
    {
      stroke: new Stroke(
      {
        color: 'red',
        width: 3
      }),
      text: this.getTextObjectForStyle(text)
    });
  }

  public static getSelectedStylePolygon(text = '')
  {
    return new Style(
    {
      stroke: new Stroke(
      {
        color: 'red',
        width: 3
      }),
      fill: new Fill(
      {
        color: 'rgba(0, 0, 255, 0.9)'
      }),
      text: this.getTextObjectForStyle(text)
    });
  }

  public static getSelectedStylePoint(text = '')
  {
    return new Style(
    {
      image: new CircleStyle(
      {
        radius: 8,
        fill: new Fill(
        {
          color: 'red'
        })
      }),
      text: this.getTextObjectForStyle(text)
    });
  }


  public static getInvisibleStyle(type)
  {
    switch(type)
    {
      case 'Polygon': return this.getInvisibleStylePolygon();
      case 'Linestring': return this.getInvisibleStyleLinestring();
      case 'Point': return this.getInvisibleStylePoint();
    }
  }

  public static getInvisibleStyleLinestring()
  {
    return new Style(
    {
      stroke: new Stroke(
      {
        color: 'rgba(0, 0, 0, 0)',
        width: 0
      })
    });
  }

  public static getInvisibleStylePolygon()
  {
    return new Style(
    {
      stroke: new Stroke(
      {
        color: 'rgba(0, 0, 0, 0)',
        width: 0
      }),
      fill: new Fill(
      {
        color: 'rgba(0, 0, 0, 0)'
      })
    });
  }

  public static getInvisibleStylePoint()
  {
    return new Style(
    {
      image: new CircleStyle(
      {
        radius: 0,
        fill: new Fill(
        {
          color: 'rgba(0, 0, 0, 0)'
        })
      })
    });
  }

  public static getCenterOfExtent(extent)
  {
    var X = extent[0] + (extent[2]-extent[0])/2;
    var Y = extent[1] + (extent[3]-extent[1])/2;
    return [X, Y];
  }

  public static transformCoorditanes(coords, sourceProjection = null, targetProjection = null)
  {
    if(sourceProjection == null) sourceProjection = this.mapProjection;
    if(targetProjection == null) targetProjection = this.userProjection;
    if(sourceProjection == targetProjection) return coords;

    return transformProjection(coords, sourceProjection, targetProjection);
  }

  public static transformFeatureCoorditanes(feature, sourceProjection = null, targetProjection = null)
  {
    if(sourceProjection == null) sourceProjection = this.mapProjection;
    if(targetProjection == null) targetProjection = this.userProjection;
    if(sourceProjection == targetProjection) return feature;

    feature.getGeometry().transform(sourceProjection, targetProjection);
    
    return feature;
  }
  
  public static getCenterFeatureFromFeature(feature)
  {
    var point = new Point(this.getCenterOfExtent(feature.getGeometry().getExtent()));
    return new Feature({ geometry: point });
  }
}