/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is IETab. Modified In Coral IE Tab.
 *
 * The Initial Developer of the Original Code is yuoo2k <yuoo2k@gmail.com>.
 * Modified by quaful <quaful@msn.com>.
 *
 * Portions created by the Initial Developer are Copyright (C) 2006-2008
 * the Initial Developer. All Rights Reserved.
 *
 * ***** END LICENSE BLOCK ***** */
var {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components; 

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const _COBA_WATCH_CID = Components.ID('{4A5F2348-6943-4d85-A652-A7F32B68259B}');
const _COBA_WATCH_CONTRACTID = "@mozilla.com.cn/coba;1";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");


["LOG", "WARN", "ERROR"].forEach(function(aName) {
  this.__defineGetter__(aName, function() {
    Cu.import("resource://gre/modules/AddonLogging.jsm");

    LogManager.getLogger("COBA", this);
    return this[aName];
  });
}, this);

function httpGet (url, onreadystatechange) {
	var xmlHttpRequest = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
  xmlHttpRequest.QueryInterface(Ci.nsIJSXMLHttpRequest);
	xmlHttpRequest.open('GET', url, true);
	xmlHttpRequest.send(null);
	xmlHttpRequest.onreadystatechange = function() {
		onreadystatechange(xmlHttpRequest);
	};
};
   
function updateFilter (timer) {
	var updateUrl = Services.prefs.getCharPref("extensions.coba.official.updateurl", null);
	if(!updateUrl)
	  return;
	httpGet(updateUrl, function(response) {
		if (response.readyState == 4 && 200 == response.status) {
			var filter = response.responseText;
			if (filter) {
        Services.prefs.setCharPref("extensions.coba.official.filterlist", filter);
			}
		}
	});  
}

function checkIECompatMode(){
  var wrk = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);
  wrk.create(wrk.ROOT_KEY_LOCAL_MACHINE, "SOFTWARE\\Microsoft\\Internet Explorer", wrk.ACCESS_READ);

  var value = "";
  try{
    value = wrk.readStringValue("version");
    wrk.close();
    value = value.split('.')[0];
  }catch(e) {ERROR(e)}
  var version = 8000;
  if(value ==  "9")
    version = 9000;
  else if(value ==  "7")
    version = 7000;
  else
    version = 8000;
  wrk.close();

  wrk = Cc["@mozilla.org/windows-registry-key;1"].createInstance(Ci.nsIWindowsRegKey);
  wrk.create(wrk.ROOT_KEY_CURRENT_USER, "SOFTWARE\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION", wrk.ACCESS_ALL);
  try{
    value = 0;
    value = wrk.readIntValue("firefox.exe");
  }catch(e) {ERROR(e)}

  if (value != 0) {
    wrk.close();
    return;
  }

  try{
    wrk.writeIntValue("firefox.exe", version);
  }catch(e) {ERROR(e)}
  wrk.close();
}
var prefOberver = {
  QueryInterface: function(aIID) {
    const Ci = Components.interfaces;
    if (aIID.equals(Ci.nsIObserver) ||
        aIID.equals(Ci.nsISupportsWeakReference) ||
        aIID.equals(Ci.nsISupports))
      return this;
  
    throw Components.results.NS_ERROR_NO_INTERFACE;
  },
  
  observe: function(aSubject, aTopic, aPrefName) {
    if (aTopic != "nsPref:changed")
      return;
    if(Services.prefs.getBoolPref("dom.ipc.plugins.enabled.npietab.dll", true))
      Services.prefs.setBoolPref("dom.ipc.plugins.enabled.npietab.dll", false);
    if(Services.prefs.getBoolPref("dom.ipc.plugins.enabled.npietab2.dll", true))
      Services.prefs.setBoolPref("dom.ipc.plugins.enabled.npietab2.dll", false);
    if(Services.prefs.getBoolPref("dom.ipc.plugins.enabled.npcoralietab.dll", true))
      Services.prefs.setBoolPref("dom.ipc.plugins.enabled.npcoralietab.dll", false);
  },
  
}
function conflictAddons(){
  Services.prefs.addObserver("dom.ipc.plugins.enabled.npietab.dll", prefOberver, true);
  Services.prefs.addObserver("dom.ipc.plugins.enabled.npietab2.dll", prefOberver, true);
  Services.prefs.addObserver("dom.ipc.plugins.enabled.npcoralietab.dll", prefOberver, true);
  Services.prefs.setBoolPref("dom.ipc.plugins.enabled.npietab.dll", false);
  Services.prefs.setBoolPref("dom.ipc.plugins.enabled.npietab2.dll", false);
  Services.prefs.setBoolPref("dom.ipc.plugins.enabled.npcoralietab.dll", false);
}
var watchFactoryClass = function() {
  this.wrappedJSObject = this;
}

watchFactoryClass.prototype = {
  classID: _COBA_WATCH_CID,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),
  
  observe: function (aSubject, aTopic, aData) {
    switch (aTopic) {
    case "profile-after-change":
      updateFilter();
      checkIECompatMode();
      conflictAddons();
      break;
    };
  }
}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([watchFactoryClass]);
