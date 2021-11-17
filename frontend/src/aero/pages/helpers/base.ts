import { environment } from './../../../environments/environment';

declare var $: any;
document.title = environment.title;

export abstract class BaseHelper 
{     
  public static angaryosUrlPath:string = environment.urlPath;

  public static formSendMethod = 'POST';
  
  public static backendBaseUrl:string = "https://"+environment.host+"/";
  public static backendUrl:string = "https://"+environment.host+"/api/v1/";
  public static dashboardUrl:string = "https://"+environment.host+"/#/"+environment.urlPath+"/dashboard";
  public static baseUrl:string = "https://"+environment.host+"/#/"+environment.urlPath+"/";
  
  public static noImageUrl = 'assets/img/404.png';

  public static _keyStr = environment.encryptKey;

  public static tokenTimeOut = 1000 * 60 * 60 * 24 * 5;
  public static token:string = "";
  public static firebaseToken:string = "";
  public static debug:boolean = true;
  public static loggedInUserInfo = null;

  public static backendServiceControl = null;

  public static addedScripts = {};
  public static pipe = {};
  
  public static isMobileDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()));

  public static liveDataModeIntervalIds = [];
  
  public static pageRefreshCounter = 600;//60 * 10
  
  public static isAndroid = null;
  public static isIos = null;
  public static isBrowser = null;
  
  
  
  public static preLoad()
  {
    this.fillUserData();
  }



  /****    General Function    ****/

  public static async getScript(url, callback = null)
  {
    await $.ajax({
        type: "GET",
        url: url,
        success: () =>
        {
          if(callback != null) callback();
        },
        dataType: "script",
        cache: true
    });
  }

  public static sleep(ms) 
  {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static getObjectKeys(obj)
  {
    if(obj == null) return [];
    return Object.keys(obj);
  }

  public static htmlStripTags(html)
  {
    return html.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  public static replaceAll(str, oldStr, newStr)
  {
    return str.split(oldStr).join(newStr);
  }

  public static doInterval(id, func, params, duration = 1000)
  {
    return new Promise(async (resolve) => 
    {
      id = "intervalId"+id;

      if(typeof this.pipe[id] != "undefined") 
        clearInterval(this.pipe[id]);

      this.pipe[id] = setInterval(async () =>
      {
        clearInterval(this.pipe[id]);
        delete this.pipe[id];
        
        if(typeof this.pipe[id+"ReturnData"] == "undefined" || this.pipe[id+"ReturnData"] == null)
            this.pipe[id+"ReturnData"] = await func(params);
                
        resolve(this.pipe[id+"ReturnData"]);
      }, duration);

      while(true)
      { 
        if((typeof this.pipe[id] == "undefined" || this.pipe[id] == null) && typeof this.pipe[id+"ReturnData"] != "undefined")
        {
          resolve(this.pipe[id+"ReturnData"]);
          break;
        }
        await BaseHelper.sleep(100);
      }
    });
  }

  public static async waitForOperationTest(resolve, func)
  {
    var count = 20;
    var control = true;
    
    while(control) 
    {
        try 
        {
            func(); 
            control = false;
        } 
        catch (error) 
        {
            await BaseHelper.sleep(100); 
        } 

        if(--count == 0) control = false;
      }
            
      resolve();
  }

  public static async waitForOperation(func)
  {
    return new Promise((resolve, error) => this.waitForOperationTest(resolve, func));
  } 
  
  public static formatMoney(number, decPlaces, decSep, thouSep) 
  {
    decPlaces = isNaN(decPlaces = Math.abs(decPlaces)) ? 2 : decPlaces,
    decSep = typeof decSep === "undefined" ? "." : decSep;
    thouSep = typeof thouSep === "undefined" ? "," : thouSep;
    var sign = number < 0 ? "-" : "";
    var i = String(parseInt(number = Math.abs(Number(number) || 0).toFixed(decPlaces)));
    var j = (j = i.length) > 3 ? j % 3 : 0;

    return sign +
        (j ? i.substr(0, j) + thouSep : "") +
        i.substr(j).replace(/(\decSep{3})(?=\decSep)/g, "$1" + thouSep) +
        (decPlaces ? decSep + Math.abs(number - parseInt(i)).toFixed(decPlaces).slice(2) : "");
  }
  
  public static clearLiveDataModeIntervals()
  {
    for(var i = 0; i < this.liveDataModeIntervalIds.length; i++)
      clearInterval(this.liveDataModeIntervalIds[i]);

    this.liveDataModeIntervalIds = [];
  }



  /****    User Operation Functions    ****/

  private static fillUserData()
  {
    this.fillTokenIfExist();
    this.fillLoggedInUserInfoIfExist();
  }

  private static fillTokenIfExist()
  {
    var temp = this.readFromLocal("token");
    if(temp != null) this.token = temp;
    
    temp = this.readFromLocal("firebaseToken");
    if(temp != null) this.firebaseToken = temp;
  }

  private static fillLoggedInUserInfoIfExist()
  {
    var temp = this.readFromLocal("loggedInUserInfo");
    if(temp != null) this.loggedInUserInfo = temp;
  }

  public static setToken(token)
  {
    this.writeToLocal("token", token, this.tokenTimeOut)
    this.token = token;
  }

  public static setLoggedInUserInfo(info)
  {
    this.writeToLocal("loggedInUserInfo", info, this.tokenTimeOut)
    this.loggedInUserInfo = info;
  }

  public static clearUserData()
  {
    this.clearToken();
    this.clearLoggedInUserInfo();
  }

  public static clearToken()
  {
    this.removeFromLocal("token");
    this.token = "";
  }

  public static clearLoggedInUserInfo()
  {
    this.removeFromLocal("loggedInUserInfo");
    this.loggedInUserInfo = "";
  } 

  public static closeModal(id)
  {
    $('#'+id).click();
  }
 


  /***   Data Functions    ****/
  
  public static getAllFormsData(baseElementSelector)
  {
    var data = {};
    
    var temp = $(baseElementSelector+' input');
    for(var i = 0; i < temp.length; i++)
    {
        var element = $(temp[i]);
        data[element.attr('name')] = element.val();
    }
    
    var temp = $(baseElementSelector+' select');
    for(var i = 0; i < temp.length; i++)
    {
        var element = $(temp[i]);
        data[element.attr('name')] = element.val();
    }  
   
    return data;   
  }

  public static getElementTitle(title, defaultTitle = "")
  {
    if(title == null) return defaultTitle;
    if(title == "") return defaultTitle;
    if(title.substr(0, 1) == "*") return defaultTitle;
    
    return title;
  }

  public static getFileUrl(file, prefix)
  {
    if(file == null) return this.noImageUrl;

    var temp = file['destination_path']+prefix+file['file_name'];
    switch(file['disk'])
    {
      case 'fileServer': 
      case 'uploads': 
        temp = "uploads/"+temp;
        break;
      default: console.log("undefined.backend.disk");
    }
    
    return "https://"+environment.host+"/"+temp;
  }

  public static ucfirst(s)
  {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  
  public static writeToLocal(key, value, timeOut = -1)
  {
    if(timeOut == 0) return;

    var obj = 
    {
      "data": value,
      "timeOut": timeOut
    };

    if(timeOut > 0) obj["startTime"] = new Date().toString();

    var jsonStr = this.objectToJsonStr(obj);
    jsonStr = this.encode(jsonStr);

    localStorage.setItem(key, jsonStr);
  }

  private static getLocalDataExpiration(obj)
  {
    if(obj.timeOut < 0) return true;

    var startTime = new Date(obj.startTime);
    var now = new Date();

    var interval = now.getTime() - startTime.getTime();

    return interval < obj.timeOut;
  }

  public static readFromLocal(key)
  {
    var jsonStr = localStorage.getItem(key);
    if(jsonStr == null) return null;

    jsonStr = this.decode(jsonStr);

    var obj = this.jsonStrToObject(jsonStr);

    if(this.getLocalDataExpiration(obj))
      return obj.data;
    else
    {
      this.removeFromLocal(key);
      return null;
    }
  }

  public static removeFromLocal(key)
  {
    localStorage.removeItem(key);
  }

  public static objectToJsonStr(obj)
  {
    return JSON.stringify(obj);
  }

  public static jsonStrToObject(jsonStr)
  {
    if(jsonStr == "") return "";
    return JSON.parse(jsonStr);    
  }

  public static getCloneFromObject(obj)
  {
    var str = this.objectToJsonStr(obj);
    return this.jsonStrToObject(str);
  }

  public static dateToDBString(date) 
  {
    function zeroPad(d) 
    {
      return ("0" + d).slice(-2)
    }

    try 
    {
      var rt = [date.getUTCFullYear(), zeroPad(date.getMonth() + 1), zeroPad(date.getDate())].join("-");
      rt += " ";
      rt += [zeroPad(date.getHours()), zeroPad(date.getMinutes()), zeroPad(date.getSeconds())].join(":");
      return rt;
    } catch (error) { }

    return "";
  }

  public static dBDateTimeStringToHumanDateTimeString(dateString) 
  {
    if(dateString == null || dateString.length == 0) return dateString;
    
    var arr = dateString.split(' ');
    var date = arr[0].split('-');
    return date[2]+"/"+date[1]+"/"+date[0]+" "+arr[1];
  }

  public static dBDateStringToHumanDateString(dateString) 
  {
    if(dateString == null || dateString.length == 0) return dateString;
    
    var date = dateString.split('-');
    return date[2]+"/"+date[1]+"/"+date[0];
  }

  public static humanDateTimeStringToDBDateTimeString(dateString) 
  {
    if(dateString == null || dateString.length == 0) return dateString;

    var arr = dateString.split(' ');
    var date = arr[0].split('/');
    return date[2]+"-"+date[1]+"-"+date[0]+" "+arr[1];
  }

  public static humanDateStringToDBDateString(str)
  {
    if(str == null || str.length == 0) return str;

    var date = str.split('/');
    return date[2]+"-"+date[1]+"-"+date[0];
  }

  public static writeToPipe(key, data, debug = false)
  {
      if(debug) console.log('Write To Pipe: ' + key);
      this.pipe[key] = data;
  }

  public static readFromPipe(key, debug = false)
  {
      if(debug) console.log('Read From Pipe: ' + key);

      if(typeof this.pipe[key] == "undefined") return null;

      return this.pipe[key];
  }

  public static deleteFromPipe(key, debug = false)
  {
      if(debug) console.log('Delete From Pipe: ' + key);

      if(typeof this.pipe[key] == "undefined") return;

      delete this.pipe[key];
  }



  /****    Cryption Functions    ****/

  public static encode(str)
  {
    return str;
  }

  public static decode(str)
  {
    return str;
  }
}

setTimeout(() =>
{
    if(!BaseHelper.isBrowser)
    {
        var _error = console.error;
        console.error = function() 
        {
          console.log("error araya girdi");
          return _error.apply(console, arguments);
        };
    }
}, 500);