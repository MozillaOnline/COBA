/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://coba/logger.jsm');

const COBA_WATCH_CID = Components.ID('{4A5F2348-6943-4d85-A652-A7F32B68259B}');

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/AddonManager.jsm');

let Strings = Services.strings.createBundle('chrome://coba/locale/global.properties');

let IDS = ['coralietab@mozdev.org',
           'IE Tab +',
           'ietab@ip.cn',
           'IE Tab Plus',
           '{77b819fa-95ad-4f2c-ac7c-486b356188a9}',
           'IE Tab',
           '{1BC9BA34-1EED-42ca-A505-6D2F1A935BBB}',
           'IE Tab 2',
           'fireie@fireie.org',
           Strings.GetStringFromName('coba.conflict.askuser.fireie')
          ];

Logger.getLogger(this);

function httpGet(url, onreadystatechange) {
  let xmlHttpRequest = Cc['@mozilla.org/xmlextras/xmlhttprequest;1'].createInstance(Ci.nsIXMLHttpRequest);
  xmlHttpRequest.open('GET', url, true);
  xmlHttpRequest.send(null);
  xmlHttpRequest.onreadystatechange = function() {
    onreadystatechange(xmlHttpRequest);
  };
};

function updateFilter() {
  let updateUrl = Services.prefs.getCharPref('extensions.coba.official.updateurl', null);
  if(!updateUrl) return;

  httpGet(updateUrl, function(response) {
    if (response.readyState == 4 && 200 == response.status) {
      let filter = response.responseText;
      if (filter) {
        Services.prefs.setCharPref('extensions.coba.official.filterlist', filter);
      }
    }
  });
}

let prefOberver = {
  QueryInterface: function(aIID) {
    const Ci = Components.interfaces;
    if (aIID.equals(Ci.nsIObserver) ||
        aIID.equals(Ci.nsISupportsWeakReference) ||
        aIID.equals(Ci.nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  observe: function(aSubject, aTopic, aPrefName) {
    if (aTopic != 'nsPref:changed') return;

    if(Services.prefs.getBoolPref('dom.ipc.plugins.enabled.npietab.dll', true))
      Services.prefs.setBoolPref('dom.ipc.plugins.enabled.npietab.dll', false);
    if(Services.prefs.getBoolPref('dom.ipc.plugins.enabled.npietab2.dll', true))
      Services.prefs.setBoolPref('dom.ipc.plugins.enabled.npietab2.dll', false);
    if(Services.prefs.getBoolPref('dom.ipc.plugins.enabled.npcoralietab.dll', true))
      Services.prefs.setBoolPref('dom.ipc.plugins.enabled.npcoralietab.dll', false);
  },
};

function setPref() {
//  Services.prefs.addObserver('dom.ipc.plugins.enabled.npietab.dll', prefOberver, true);
//  Services.prefs.addObserver('dom.ipc.plugins.enabled.npietab2.dll', prefOberver, true);
//  Services.prefs.addObserver('dom.ipc.plugins.enabled.npcoralietab.dll', prefOberver, true);
//  Services.prefs.setBoolPref('dom.ipc.plugins.enabled.npietab.dll', false);
//  Services.prefs.setBoolPref('dom.ipc.plugins.enabled.npietab2.dll', false);
//  Services.prefs.setBoolPref('dom.ipc.plugins.enabled.npcoralietab.dll', false);
}
function resetPref(){
//  Services.prefs.removeObserver('dom.ipc.plugins.enabled.npietab.dll', prefOberver);
//  Services.prefs.removeObserver('dom.ipc.plugins.enabled.npietab2.dll', prefOberver);
//  Services.prefs.removeObserver('dom.ipc.plugins.enabled.npcoralietab.dll', prefOberver);
//  Services.prefs.deleteBranch('dom.ipc.plugins.enabled.npietab.dll');
//  Services.prefs.deleteBranch('dom.ipc.plugins.enabled.npietab2.dll');
//  Services.prefs.deleteBranch('dom.ipc.plugins.enabled.npcoralietab.dll');
}

function askUser(window, finds) {
  if(finds.length == 0) return false;

  let prompter = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService);
  let always = { value: true };
  let flag = prompter.BUTTON_POS_0 * prompter.BUTTON_TITLE_IS_STRING  +
             prompter.BUTTON_POS_1 * prompter.BUTTON_TITLE_CANCEL;
  let text = Strings.GetStringFromName('coba.conflict.askuser.string1');
  for (let i = 0; i < finds.length ; i++) {
    text += ' - ';
    text += IDS[finds[i]+1];
    text += '\n';
  }
  let ret = prompter.confirmEx(null,
          Strings.GetStringFromName('coba.conflict.askuser.string2'), text, flag,
          '    '+Strings.GetStringFromName('coba.conflict.askuser.string3')+'    ', null, null, Strings.GetStringFromName('coba.conflict.askuser.string4'), always) == 0;    // 0=='打开附加组件管理器' button
  Services.prefs.setBoolPref('extensions.coba.conflict.warning', always.value);
  return ret;
}

function checkConflict(window) {
  window.setTimeout(function() {
    if(!Services.prefs.getBoolPref('extensions.coba.conflict.warning', true))
      return;
    AddonManager.getAllAddons(function(addons) {
      let finds = [];
      for (let num in addons) {
        let addon = addons[num];
        let index = IDS.indexOf(addon.id);
        if (index > -1 && !addon.userDisabled){
          finds.push(index);
        }
      }
      if(askUser(window, finds)){
        window.BrowserOpenAddonsMgr();
      }
    });
  }, 1000);
}

let watchFactoryClass = function() {
  this.wrappedJSObject = this;
};

watchFactoryClass.prototype = {
  classID: COBA_WATCH_CID,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),

  window: null,
  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
    case 'profile-after-change':
      var autoUpdate;
      try {
        autoUpdate = Services.prefs.getBoolPref('extensions.coba.official.filter.update');
      } catch (ex) {
        autoUpdate = true;
      }
      if (autoUpdate) {
        updateFilter();
      }
      setPref();
      Services.obs.addObserver(this, 'quit-application', true);
      Services.obs.addObserver(this, 'domwindowopened', true);
      Services.obs.addObserver(this, 'sessionstore-windows-restored', true);
      break;
    case 'domwindowopened':
      var window = aSubject;
      this.window = window;
      if(window.location.href != 'chrome://browser/content/browser.xul')
        return;
      Services.obs.removeObserver(this, 'domwindowopened');
      break;
    case 'sessionstore-windows-restored':
      Services.obs.removeObserver(this, 'sessionstore-windows-restored');
      checkConflict(this.window);
      break;
    case 'quit-application':
      resetPref();
      break;
    };
  }
};

let NSGetFactory = XPCOMUtils.generateNSGetFactory([watchFactoryClass]);
