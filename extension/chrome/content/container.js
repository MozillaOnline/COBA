/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://coba/cobaUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/PlacesUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Preferences.jsm");

let tracking_random = Math.random();

function tracking(type) {
  let tracker = Cc['@mozilla.com.cn/tracking;1'];
  if (!tracker || !tracker.getService().wrappedJSObject.ude) {
    return;
  }
  try{
    let uuidPrf = 'extensions.coba.uuid';
    let uuid = Preferences.get(uuidPrf, '');
    if (uuid == ''){
      let uuidgen = Cc['@mozilla.org/uuid-generator;1'].getService(Ci.nsIUUIDGenerator);
      uuid = uuidgen.generateUUID().number;
      Preferences.set(uuidPrf, uuid);
    }
    let trackurl = 'http://addons.g-fox.cn/coba.gif';
    let image = new Image();
    image.src = trackurl + '?r=' + tracking_random
              + '&uuid=' + uuid
              + '&type=' + type;
  }catch(e){}
}

let trackingComplete = false;

function tracking_onLoadComplete(){
  if(!trackingComplete){
    trackingComplete = true;
    tracking('LoadComplete');
  }
}


var COBAContainer = {
  init: function() {
    tracking('init');
    window.removeEventListener('DOMContentLoaded', COBAContainer.init, false);
    var container = document.getElementById('container');
    if (!container) {
      cobaUtils.ERROR('Cannot find container to insert coba-object.');
      return;
    }
    if (COBAContainer._isInPrivateBrowsingMode()) {
      container.innerHTML = '<iframe src="PrivateBrowsingWarning.xhtml" width="100%" height="100%" frameborder="no" border="0" marginwidth="0" marginheight="0" scrolling="no" allowtransparency="yes"></iframe>';
    } else {
      COBAContainer._registerEventHandler();
    }
    window.setTimeout(function() {
      var pluginObject = document.getElementById(COBA.objectID);;
      document.title = pluginObject.Title;
    }, 200);
  },

  destroy: function(event) {
    window.removeEventListener('unload', COBAContainer.destroy, false);
    COBAContainer._unregisterEventHandler();
  },

  _getNavigateParam: function(name) {
    let headers = '';
    let tab = cobaUtils.getTabFromDocument(document);
    let navigateParams = cobaUtils.getTabAttributeJSON(tab, COBA.navigateParamsAttr);
    if (navigateParams && typeof navigateParams[name] != 'undefined') {
      headers = navigateParams[name];
    }
    return headers;
  },

  getNavigateHeaders: function() {
    return this._getNavigateParam('headers');
  },

  getNavigatePostData: function() {
    return this._getNavigateParam('post');
  },

  getNavigateWindowId: function() {
    return this._getNavigateParam('id');
  },

  removeNavigateParams: function() {
    let tab = cobaUtils.getTabFromDocument(document);
    let navigateParams = cobaUtils.getTabAttributeJSON(tab, COBA.navigateParamsAttr);
    if (navigateParams) {
      tab.removeAttribute(COBA.navigateParamsAttr);
    }
  },

  _isInPrivateBrowsingMode: function() {
    let pbs;
    try { pbs = Cc['@mozilla.org/privatebrowsing;1'].getService(Ci.nsIPrivateBrowsingService); } catch (e) {}
    let privatebrowsingwarning = pbs && pbs.privateBrowsingEnabled && Services.prefs.getBoolPref('extensions.coba.privatebrowsingwarning', true);

    if (privatebrowsingwarning) {
      let cookieService = Cc['@mozilla.org/cookieService;1'].getService(Ci.nsICookieService);
      try {
        let pbwFlag = cookieService.getCookieString(Services.io.newURI('http://coba/', null, null), null);
        if (pbwFlag) {
          privatebrowsingwarning = pbwFlag.indexOf('privatebrowsingwarning=no') < 0;
          Services.cookies.remove('coba', 'privatebrowsingwarning', '/', false);
        }
      }
      catch (e) {ERROR(e)}
    }

    return privatebrowsingwarning;
  },

  _registerEventHandler: function() {
    window.addEventListener('PluginNotFound', COBAContainer._pluginNotFoundListener, false);
    window.addEventListener('IeTitleChanged', COBAContainer._onTitleChanged, false);
    window.addEventListener('CloseIETab', COBAContainer._onCloseIETab, false);
    window.addEventListener('Loading', COBAContainer._onLoading, false);
    window.addEventListener('LoadComplete', COBAContainer._onLoadComplete, false);
    let pluginObject = document.getElementById(COBA.objectID);
    if (pluginObject) {
      pluginObject.addEventListener('focus', COBAContainer._onPluginFocus, false);
    }
  },

  _unregisterEventHandler: function(){
    window.removeEventListener('PluginNotFound', COBAContainer._pluginNotFoundListener, false);
    window.removeEventListener('IeTitleChanged', COBAContainer._onTitleChanged, false);
    window.removeEventListener('CloseIETab', COBAContainer._onCloseIETab, false);
    window.removeEventListener('Loading', COBAContainer._onLoading, false);
    window.removeEventListener('LoadComplete', COBAContainer._onLoadComplete, false);
    let pluginObject = document.getElementById(COBA.objectID);
    if (pluginObject) {
      pluginObject.removeEventListener('focus', COBAContainer._onPluginFocus, false);
    }
  },

  _pluginNotFoundListener: function(event) {
    alert('Loading COBA plugin failed. Please try restarting Firefox.');
  },

  /** 响应Plugin标题变化事件 */
  _onTitleChanged: function(event) {
    var title = event.detail;
    document.title = title;
  },

  /** 响应关闭IE标签窗口事件 */
  _onCloseIETab: function(event) {
    window.setTimeout(function() {
      window.close();
    }, 100);
  },

  firefoxFilterList : [],

  isMatchURL: function(url, pattern) {
    if ((!pattern) || (pattern.length == 0)) return false;
    let retest = /^\/(.*)\/$/.exec(pattern);
    if (retest) {
       pattern = retest[1];
    } else {
       pattern = pattern.replace(/\\/g, '/');
       let m = pattern.match(/^(.+:\/\/+[^\/]+\/)?(.*)/);
       m[1] = (m[1] ? m[1].replace(/\./g, '\\.').replace(/\?/g, '[^\\/]?').replace(/\*/g, '[^\\/]*') : '');
       m[2] = (m[2] ? m[2].replace(/\./g, '\\.').replace(/\+/g, '\\+').replace(/\?/g, '\\?').replace(/\*/g, '.*') : '');
       pattern = m[1] + m[2];
       pattern = '^' + pattern + '$';
    }
    let reg = new RegExp(pattern.toLowerCase());
    return (reg.test(url.toLowerCase()));
  },

  isMatchFilterList : function(url) {
    let aList = this.firefoxFilterList;
    for (let i = 0; i < aList.length; i++) {
       let rule = aList[i];
       if (this.isMatchURL(url, rule))
         return true;
    }
    return false;
  },

  /** 响应开始加载事件*/
  _onLoading: function(event) {
    let pluginObject = event.originalTarget;
    let url = pluginObject.URL;
    if (COBAContainer.isMatchFilterList(url)) {
      Services.obs.notifyObservers(document, 'COBA-swith-to-ie', null);
    }
  },

  /** 响应加载完成事件 */
  _onLoadComplete: function(event) {
    tracking_onLoadComplete();
    let pluginObject = event.originalTarget;
    let url = pluginObject.FaviconURL;

    let icon = document.getElementById('icon');
    icon.setAttribute('href',url);
    icon.parentNode.appendChild(icon);
  },

  /**
   * 当焦点在plugin对象上时，在plugin中按Alt+XXX组合键时
   * 菜单栏无法正常弹出，因此当plugin对象得到焦点时，需要
   * 调用其blus方法去除焦点
   */
  _onPluginFocus: function(event) {
    let pluginObject = event.originalTarget;
    pluginObject.blur();
    pluginObject.Focus();
  }
};

window.addEventListener('DOMContentLoaded', COBAContainer.init, false);
window.addEventListener('unload', COBAContainer.destroy, false);
