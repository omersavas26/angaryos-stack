import { BaseHelper } from './base';
import { MessageHelper } from './message';
import { Injectable } from '@angular/core';
import { Location } from '@angular/common'
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { File } from '@ionic-native/file/ngx';
import { Camera, CameraOptions } from '@ionic-native/camera/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { Device } from '@ionic-native/device/ngx';
import { NFC, Ndef } from '@ionic-native/nfc/ngx';

import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

declare var $: any;
declare var cordova: any;

@Injectable()
export class GeneralHelper 
{     
  constructor(
    public router: Router,
    public platform: Platform,
    public location: Location,
    public messageHelper: MessageHelper,
    private camera: Camera,
    private geolocation: Geolocation,
    private file: File,
    private device: Device,
    private nfc: NFC, 
    private ndef: Ndef
    )
  { }
  
  public getDeviceInfo()
  {
    return {
      'cordova': this.device.cordova,
      'model': this.device.model,
      'platform': this.device.platform,
      'uuid': this.device.uuid,
      'version': this.device.version,
      'manufacturer': this.device.manufacturer,
      'isVirtual': this.device.isVirtual,
      'serial': this.device.serial
    }
  }
  
  public nativeControl(message = true)
  {
    if(typeof cordova != "undefined") return true;
    
    if(message) this.messageHelper.sweetAlert('Bu özellik yalnızca mobil uygulamada kullanılabilir!', 'Hata', 'error');
    return false;
  }
  
  public async readNfcTag(message = true)
  {
    if(!this.nativeControl())
        return new Promise((resolve, reject) => 
        {
            reject("cordova_not_available");
        });

    if(BaseHelper.isAndroid) return this.readNfcTagAndroid(message);    
    else if(BaseHelper.isIos) return this.readNfcTagIos(message);
    else return new Promise((resolve, reject) => 
        {
            reject("uncorrect_native_os_type");
        });
  }
  
  public readNfcTagIos(message)
  {
    return new Promise(async (resolve, reject) => 
    {
        this.startLoading("Kartı okutunuz...");

        try 
        {
            let tag = await this.nfc.scanNdef();
            this.stopLoading("Kartı okutunuz...");
            alert("ok "+JSON.stringify(tag));
            resolve(tag);
        } 
        catch (err) 
        {
            this.stopLoading("Kartı okutunuz...");
            alert("err "+JSON.stringify(err));
            reject(err);
        }
    });
  }
  
  public readNfcTagAndroid(message)
  {
    return new Promise((resolve, reject) => 
    {
       this.startLoading("Kartı okutunuz...");

        let flags = this.nfc.FLAG_READER_NFC_A | this.nfc.FLAG_READER_NFC_V;
        this.nfc.readerMode(flags).subscribe(tag =>  //tag:  {"id": [-80, -96, -58, 53], "techTypes": ["android.nfc.tect.MifareClasic", "android.nfc.tect.NfcA", "....NdefFormateble"]}
        {   
            this.stopLoading("Kartı okutunuz...");
            resolve(tag);
            this.nfc.cancelScan();
        },
        err => 
        {
            this.stopLoading("Kartı okutunuz...");

            if(message)
            {
                switch(err)
                {
                  case "NO_NFC":
                    this.messageHelper.sweetAlert('Malesef telefonunuzda NFC özelliği yok!', 'Hata', 'error');
                    break;
                  case "NFC_DISABLED":
                    this.messageHelper.sweetAlert('Şuan NFC kapalı. Ayarlara giderek önce onu açınız!', 'Hata', 'error');
                    break;
                  default: break;
                }
            }

            reject(err);
            this.nfc.cancelScan();
        }); 
    });
  }
  
  public async checkMockLocation(timeOut = 5000)
  {
    var control = null;
    
    try 
    {
      var fn = window['plugins']['mockgpschecker']['check'];

      fn(function(result)
      {
        control = result['isMock'];
      });
    } 
    catch (error) 
    {
      control = false;
    }

    var start = (new Date()).getTime();
    do 
    {
      await BaseHelper.sleep(100); 
      var now = (new Date()).getTime();
    } while (control == null && (now - start) < timeOut);
    
    return control;
  }
  
  public getGeoLocation(options = null, message = true)
  {
    this.startLoading("Konumunuz alınıyor...");

    if(options == null)
        options = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        };
        
    return new Promise((resolve, reject) => 
    {
        this.geolocation.getCurrentPosition(options).then((resp) => 
        {
          this.stopLoading("Konumunuz alınıyor...");
          resolve(resp);
        })
        .catch((error) => 
        {
          this.stopLoading("Konumunuz alınıyor...");
          if(message) this.messageHelper.sweetAlert('Konumunuz alınamadı! Cihazının konum ayarının açık olduğundan emin olun.', 'Konum Alınamadı', 'error');
          reject(error)
        });
    });
  }
  
  public takePhoto(returnType = "imageUrl", quality = 100, targetHeight = 768, targetWidth = 1024, saveToPhotoAlbum = false)
  {
    var type = this.camera.DestinationType.FILE_URI;
    if(returnType == "base64Image") type = this.camera.DestinationType.DATA_URL;

    const options: CameraOptions = 
    {
      quality: quality,
      targetHeight: targetHeight,
      targetWidth: targetWidth,
      destinationType: type,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE,
      saveToPhotoAlbum: saveToPhotoAlbum
    }

    return new Promise((resolve, reject) => 
    {
      this.camera.getPicture(options).then(image => 
      {
        if(returnType == "base64Image") image = 'data:image/jpeg;base64,'+image;
        resolve(image);        
      },  
      err => 
      {
        reject(err);
      });
    });
  }
  
  public convertBase64ToBlob(base64: string) 
  {
    const info = this.getInfoFromBase64(base64);
    const sliceSize = 512;
    const byteCharacters = window.atob(info.rawBase64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: info.mime });
  }

  public getInfoFromBase64(base64: string) 
  {
    const meta = base64.split(',')[0];
    const rawBase64 = base64.split(',')[1].replace(/\s/g, '');
    const mime = /:([^;]+);/.exec(meta)[1];
    const extension = /\/([^;]+);/.exec(meta)[1];

    return {
      mime,
      extension,
      meta,
      rawBase64
    };
  }
  
  public fillPlatformVariables()
  {
      BaseHelper.isAndroid = this.platform.is("android");
      BaseHelper.isIos = this.platform.is("ios");
      BaseHelper.isBrowser = this.platform.is("desktop");
      
      if(!BaseHelper.isAndroid && !BaseHelper.isIos) BaseHelper.isBrowser = true;
      
      console.log("a: "+BaseHelper.isAndroid+", i: "+BaseHelper.isIos+", b: "+BaseHelper.isBrowser)
  }
  
  public goBackPage()
  {
    this.location.back()
  }

  public pageNormalizeForNavigate(page)
  {
    if(page.substr(0, 1) != '/' && page.indexOf('://') == -1) 
      page = BaseHelper.angaryosUrlPath+"/"+page;

    return page;
  }

  public navigateNewPage(page)
  {
    if(page.indexOf('://') == -1) page = BaseHelper.backendBaseUrl + "#" + page;        
    if(BaseHelper.isBrowser) window.open(page);
    else window.open(page, '_system', 'location=yes');
  }
  
  public navigateWebUrl(page)
  {
    if(BaseHelper.isBrowser) window.location.href = page;
    else window.open(page, '_system', 'location=yes');
  }

  public navigateAngaryosPage(page)
  {
    this.router.navigateByUrl(page);

    if(!BaseHelper.isAndroid && !BaseHelper.isIos) return;
  
    $('#leftsidebar').removeClass('open');
    $('section').css('margin-right', '0');
    $('.navbar-nav').css('right', '-40');
  }

  public saveLastPage(page)
  {
    if(page.indexOf('/login') > -1) return;
    if(page.indexOf('dashboard') > -1) return;
    if(page.indexOf('/home') > -1) return;
    if(page.indexOf(BaseHelper.angaryosUrlPath+"/") == -1) return;

    page = page.replace(BaseHelper.backendBaseUrl + "#", '');
    if(page.substr(0, BaseHelper.angaryosUrlPath.length+1) == BaseHelper.angaryosUrlPath+"/") page = "/"+page;

    if(BaseHelper.loggedInUserInfo == null) return
    var key = 'user:'+BaseHelper.loggedInUserInfo['user']["id"]+".lastPage"; 
    BaseHelper.writeToLocal(key, page);
  }

  public navigate(page:string, newPage = false)
  {
    if(BaseHelper.pipe["ctrlKey"]) newPage = true;

    page = this.pageNormalizeForNavigate(page);
    
    this.saveLastPage(page);

    if(newPage) 
      this.navigateNewPage(page);
    else if(page.indexOf('://') > 0)
      this.navigateWebUrl(page);
    else
      this.navigateAngaryosPage(page)
  }

  public getRange(r)
  {
    var rt = [];
    for(var i = 1; i <= parseInt(r); i++)
    {
        rt.push(i);
    }

    return rt;
  }

  public startLoading(str = "Bekleyin...") 
  {
    const Toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 1000 * 60 * 15
    });

    Toast.fire({
        icon: "info",
        title: str
    });
  }

  public stopLoading(str = "Bekleyin...") 
  {
    var msg = $('#swal2-title').html();
    if (msg != str) return;

    //Swal.isVisible()
    const Toast = Swal.mixin({
        toast: true,
        position: 'top',
        showConfirmButton: false,
        timer: 100
    });

    Toast.fire({
        icon: "success",
        title: "Tamamlandı..."
    });
  }
}