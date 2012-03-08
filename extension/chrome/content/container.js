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

Cu.import("resource://coba/cobaUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var COBAContainer = {
	init: function() {
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
		
	},
	
	_getNavigateParam: function(name) {
		var headers = "";
		var tab = cobaUtils.getTabFromDocument(document);
		var navigateParams = cobaUtils.getTabAttributeJSON(tab, COBA.navigateParamsAttr);
		if (navigateParams && typeof navigateParams[name] != "undefined") {
			headers = navigateParams[name];
		}
		return headers;	
	},
	
	getNavigateHeaders: function() {
		return this._getNavigateParam("headers");
	},
	
	getNavigatePostData: function() {
		return this._getNavigateParam("post");
	},
	
	getNavigateWindowId: function() {
		return this._getNavigateParam("id") + "";		
	},
	
	removeNavigateParams: function() {
		var tab = cobaUtils.getTabFromDocument(document);
		var navigateParams = cobaUtils.getTabAttributeJSON(tab, COBA.navigateParamsAttr);
		if (navigateParams) {
			tab.removeAttribute(COBA.navigateParamsAttr);
		}	
	},

	_isInPrivateBrowsingMode: function() {
		var pbs;
		try { pbs = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService); } catch (e) {}
		var privatebrowsingwarning = pbs && pbs.privateBrowsingEnabled && Services.prefs.getBoolPref("extensions.coba.privatebrowsingwarning", true);
		
		if (privatebrowsingwarning) {
			var cookieService = Cc["@mozilla.org/cookieService;1"].getService(Ci.nsICookieService);
			try {
				var pbwFlag = cookieService.getCookieString(Services.io.newURI("http://coba/", null, null), null);
				if (pbwFlag) {
					privatebrowsingwarning = pbwFlag.indexOf("privatebrowsingwarning=no") < 0;
					Services.cookies.remove("coba", "privatebrowsingwarning", "/", false);
				}
			}
			catch (e) {ERROR(e)}
		}
		
		return privatebrowsingwarning;
	},

	_registerEventHandler: function() {
		window.addEventListener("PluginNotFound", COBAContainer._pluginNotFoundListener, false);
		window.addEventListener("IeTitleChanged", COBAContainer._onTitleChanged, false);
		window.addEventListener("CloseIETab", COBAContainer._onCloseIETab, false);
		var pluginObject = document.getElementById(COBA.objectID);
		if (pluginObject) {
			pluginObject.addEventListener("focus", COBAContainer._onPluginFocus, false);
		}
	},
	

	_pluginNotFoundListener: function(event) {
		alert("Loading COBA plugin failed. Please try restarting Firefox.");
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
	
	/**
	 * 当焦点在plugin对象上时，在plugin中按Alt+XXX组合键时，
	 * 菜单栏无法正常弹出，因此当plugin对象得到焦点时，需要
	 * 调用其blus方法去除焦点。
	 */
	_onPluginFocus: function(event) {
		var pluginObject = event.originalTarget;
		pluginObject.blur();
		pluginObject.Focus();
	}
}

window.addEventListener('DOMContentLoaded', COBAContainer.init, false);
window.addEventListener('unload', COBAContainer.destroy, false);
