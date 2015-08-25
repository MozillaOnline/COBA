/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

if (typeof(COBA) == 'undefined') {
  var COBA = {};
}
const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/AddonManager.jsm');
Cu.import('resource://coba/cobaUtils.jsm');
Cu.import('resource://gre/modules/Preferences.jsm');

let Strings = cobaUtils.Strings;

COBA.getUUID = function() {
  let pref = 'extensions.coba.uuid';
  let uuid = Preferences.get(pref, '');
  if(uuid != '') {
    return uuid;
  }

  let uuidgen = Cc['@mozilla.org/uuid-generator;1'].getService(Ci.nsIUUIDGenerator);
  uuid = uuidgen.generateUUID().number;
  Preferences.set(pref, uuid);
  return uuid;
};

COBA.track = function(data) {
  if (!data) {
    return;
  }
  let tracker = Cc["@mozilla.com.cn/tracking;1"];
  if (!tracker || !tracker.getService().wrappedJSObject.ude) {
    return;
  }
  let uuid = COBA.getUUID();
  let trackurl = 'http://addons.g-fox.cn/coba.gif';
  let image = new Image();
  image.src = trackurl + '?r=' +  Math.random()
            + '&uuid=' + uuid
            + '&' + data.key + '=' + data.value;
};

// Convert URL to IE Tab format
COBA.getCOBAURL = function(url) {
  if (COBA.startsWith(url, COBA.containerUrl)) {
    return url;
  }
  if (/^file:\/\/.*/.test(url)) {
    try {
      url = decodeURI(url).replace(/\|/g, ':');
    } catch (e) {}
  }
  return COBA.containerUrl + encodeURI(url);
};


// Get embeded plugin object
COBA.getPluginObject = function(aTab) {
  let aBrowser = aTab ? aTab.linkedBrowser : gBrowser;
  if (aBrowser && aBrowser.currentURI && COBA.startsWith(aBrowser.currentURI.spec, COBA.containerUrl)) {
    if (aBrowser.contentDocument) {
      let obj = aBrowser.contentDocument.getElementById(COBA.objectID);
      if (obj) {
        return obj.wrappedJSObject ? obj.wrappedJSObject : obj;
      }
    }
  }
  return null;
};

// Get actual URL from IE Tab URL format
COBA.getPluginObjectURL = function(aTab) {
  let tab = aTab || null;
  let aBrowser = tab ? tab.linkedBrowser : gBrowser;
  let url = COBA.getActualUrl(aBrowser.currentURI.spec);
  let pluginObject = COBA.getPluginObject(tab);
  if (pluginObject && pluginObject.URL && pluginObject.URL != '') {
    url = /^file:\/\/.*/.test(url) ? encodeURI(COBA.convertToUTF8(pluginObject.URL)) : pluginObject.URL;
  }
  return COBA.getActualUrl(url);
};

// Convert to current tab's URI to IE Tab format,
// The same as COBA.getPluginObjectURL
COBA.getCurrentIeTabURI = function(aBrowser) {
  try {
    let docShell = aBrowser.boxObject.QueryInterface(Ci.nsIBrowserBoxObject).docShell;
    let wNav = docShell.QueryInterface(Ci.nsIWebNavigation);
    if (wNav.currentURI && COBA.startsWith(wNav.currentURI.spec, COBA.containerUrl)) {
      let pluginObject = wNav.document.getElementById(COBA.objectID);
      if (pluginObject) {
        if (pluginObject.wrappedJSObject) pluginObject = pluginObject.wrappedJSObject;
        let url = pluginObject.URL;
        if (url) {
          return Services.io.newURI(COBA.containerUrl + encodeURI(url), null, null);
        }
      }
    }
  } catch (e) {
    cobaUtils.LOG('COBA.getCurrentIeTabURI: ' + e);
  }
  return null;
};

COBA.isIEEngine = function(aTab) {
  let aBrowser = aTab ? aTab.linkedBrowser : gBrowser;
  if (aBrowser && aBrowser.currentURI && COBA.startsWith(aBrowser.currentURI.spec, COBA.containerUrl)) {
    return true;
  }
  return false;
};

// Switch to IE engine by setting URL to IE Tab URL format
// Return value indicates whether switched to IE engine successfully.
COBA.switchTabEngine = function(aTab) {
  if (aTab && aTab.localName == 'tab') {
    let url = COBA.getPluginObjectURL(aTab);

    let isIEEngineAfterSwitch = !COBA.isIEEngine(aTab);
    let domain = COBA.getUrlDomain(url).toLowerCase();
    if (isIEEngineAfterSwitch && aTab.getAttribute('skipDomain') == domain) {
      aTab.setAttribute('skipDomain', '');
    }
    if (!isIEEngineAfterSwitch) {
      // Now it is IE engine, call me means users want to switch to Firefox engine.
      // We have to tell watcher that this is manual switching, do not switch back to IE engine
      aTab.setAttribute('skipDomain', domain);
    }
    let zoomLevel = COBA.getZoomLevel();
    COBA.setTabAttributeJSON(aTab, 'zoom', {zoomLevel: zoomLevel});

    if (isIEEngineAfterSwitch && !COBA.isFirefoxOnly(url)) {
      // ie tab URL
      url = COBA.getCOBAURL(url);
    }
    if (aTab.linkedBrowser && aTab.linkedBrowser.currentURI.spec != url) {
      aTab.linkedBrowser.loadURI(url);
    }

    return isIEEngineAfterSwitch;
  }
  return false;
};

COBA.setUrlBarSwitchButtonStatus = function(isIEEngine) {
  let url = COBA.getPluginObjectURL();
  let btn = document.getElementById('coba-current-engine');
  if (btn) {
    btn.disabled = COBA.isFirefoxOnly(url);
    btn.style.visibility = 'visible';
    btn.setAttribute('engine', (isIEEngine ? 'ie' : 'fx'));
  }

  // Update switch engine button label
  let label = document.getElementById('coba-urlbar-switch-label');
  if (label) {
    let labelId = isIEEngine ? 'coba.urlbar.switch.label.ie' : 'coba.urlbar.switch.label.fx';
    label.value = Strings.global.GetStringFromName(labelId);
  }

  // Update switch engine button tooltip
  let tooltip = document.getElementById('coba-urlbar-switch-tooltip2');
  if (tooltip) {
    let tooltipId = isIEEngine ? 'coba.urlbar.switch.tooltip2.ie' : 'coba.urlbar.switch.tooltip2.fx';
    tooltip.value = Strings.global.GetStringFromName(tooltipId);
  }
  let btn_urlbar_icon = document.getElementById('coba-urlbar-icon');
  btn_urlbar_icon.setAttribute('hidden', isIEEngine ? 'false' : 'true');
};

COBA.updateTabMenu = function() {
  let urlbarButton = document.getElementById('coba-urlbar-switch');
  let menu = document.getElementById('coba-tab-switch');
  if (urlbarButton && menu) {
    if (COBA.isIEEngine(COBA.getContextTab())) {
      menu.label = menu.getAttribute('data-label-fx');
    } else {
      menu.label = menu.getAttribute('data-label-ie');
    }
  }
};

COBA.switchEngine = function() {
  COBA.switchTabEngine(gBrowser.mCurrentTab);
};

COBA.openOptionsDialog = function(url) {
  url = url || COBA.getPluginObjectURL();
  let icon = document.getElementById('ietab-status');
  window.openDialog('chrome://coba/content/setting.xul', 'cobaOptionsDialog', 'chrome,centerscreen', COBA.getUrlDomain(url), icon);
};

COBA.addIeTab = function(url) {
  let newTab = gBrowser.addTab(COBA.getCOBAURL(url));
  gBrowser.selectedTab = newTab;
  if (gURLBar && url == 'about:blank') {
    window.setTimeout(function() {
      gURLBar.focus();
    }, 0);
  };
  return newTab;
};

COBA.getHandledURL = function(url, isModeIE) {
  url = url.trim();

  if (COBA.isFirefoxOnly(url)) {
    return url;
  }

  if (isModeIE) {
    return COBA.getCOBAURL(url);
  }

  if (COBA.isIEEngine() && !COBA.startsWith(url, 'about:') && !COBA.startsWith(url, 'view-source:')) {
    if (COBA.isValidURL(url) || COBA.isValidDomainName(url)) {
      let isBlank = (COBA.getActualUrl(gBrowser.currentURI.spec) == 'about:blank');
      let handleUrlBar = Preferences.get('extensions.coba.handleUrlBar', false);
      let isSimilar = (COBA.getUrlDomain(COBA.getPluginObjectURL()) == COBA.getUrlDomain(url));
      if (isBlank || handleUrlBar || isSimilar) {
        return COBA.getCOBAURL(url);
      }
    }
  }

  return url;
};

// Check URL is firfox only 
// for example: about:config, chrome://xxxx
COBA.isFirefoxOnly = function(url) {
   return url && url.length > 0 &&
             ((COBA.startsWith(url, 'about:') && url != 'about:blank') ||
              COBA.startsWith(url, 'chrome://'));
};

COBA.updateUrlBar = function() {
  COBA.setUrlBarSwitchButtonStatus(COBA.isIEEngine());

  if (!gURLBar || !COBA.isIEEngine()) {
    return;
  }
  if (gBrowser.userTypedValue) {
    if (gURLBar.selectionEnd != gURLBar.selectionStart) {
      window.setTimeout(function() {
        gURLBar.focus();
      }, 0);
    }
  } else {
    let url = COBA.getPluginObjectURL();
    if (url == 'about:blank') {
      url = '';
    }
    if (gURLBar.value != url) {
      gURLBar.value = url;
    }
  }

  // Update bookmark start state
  if (window.PlacesStarButton)
    PlacesStarButton.updateState();
  else
    BookmarkingUI.updateStarState();
};

COBA.updateObjectDisabledStatus = function(objId, isEnabled) {
  let obj = typeof(objId) == 'object' ? objId : document.getElementById(objId);
  if (!obj) {
    return;
  }
  let d = obj.hasAttribute('disabled');
  if (d != isEnabled) {
    return;
  }

  d ? obj.removeAttribute('disabled') : obj.setAttribute('disabled', true);
};

COBA.updateBackForwardButtons = function() {
  let pluginObject = COBA.getPluginObject();
  let canBack = (pluginObject ? pluginObject.CanBack : false) || gBrowser.webNavigation.canGoBack;
  let canForward = (pluginObject ? pluginObject.CanForward : false) || gBrowser.webNavigation.canGoForward;
  COBA.updateObjectDisabledStatus('Browser:Back', canBack);
  COBA.updateObjectDisabledStatus('Browser:Forward', canForward);
};

COBA.updateStopReloadButtons = function() {
  let pluginObject = COBA.getPluginObject();
  let isBlank = (gBrowser.currentURI.spec == 'about:blank');
  let isLoading = gBrowser.mIsBusy;
  COBA.updateObjectDisabledStatus('Browser:Reload', pluginObject ? pluginObject.CanRefresh : !isBlank);
  COBA.updateObjectDisabledStatus('Browser:Stop', pluginObject ? pluginObject.CanStop : isLoading);
};

COBA.updateEditMenuItems = function(e) {
  if (e.originalTarget != document.getElementById('menu_EditPopup')) {
    return;
  }
  let pluginObject = COBA.getPluginObject();
  if (pluginObject) {
    COBA.updateObjectDisabledStatus('cmd_cut', pluginObject.CanCut);
    COBA.updateObjectDisabledStatus('cmd_copy', pluginObject.CanCopy);
    COBA.updateObjectDisabledStatus('cmd_paste', pluginObject.CanPaste);
  }
};

COBA.updateSecureLockIcon = function() {
  let pluginObject = COBA.getPluginObject();
  if (pluginObject) {
    let securityButton = document.getElementById('security-button');
    if (securityButton) {
      let url = pluginObject.URL;
      const wpl = Ci.nsIWebProgressListener;
      let state = COBA.startsWith(url, 'https://') ? wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH : wpl.STATE_IS_INSECURE;
      window.XULBrowserWindow.onSecurityChange(null, null, state);
      securityButton.setAttribute('label', COBA.getUrlHost(pluginObject.URL));
    }
  }
};

COBA.updateInterface = function() {
  COBA.updateBackForwardButtons();
  COBA.updateStopReloadButtons();
  COBA.updateSecureLockIcon();

  if (!!document.getElementById('urlbar-container')) {
    COBA.updateUrlBar();
  }
};

COBA.updateAll = function() {
  if (COBA.updating) return;
  try {
    COBA.updating = true;
    COBA.updateInterface();
  } finally {
    COBA.updating = false;
  }
};

COBA.updateProgressStatus = function() {
  let mTabs = gBrowser.mTabContainer.childNodes;
  for (let i = 0; i < mTabs.length; i++) {
    if (mTabs[i].localName == 'tab') {
      let pluginObject = COBA.getPluginObject(mTabs[i]);
      if (pluginObject) {
        let aCurTotalProgress = pluginObject.Progress;
        if (aCurTotalProgress != mTabs[i].mProgress) {
          const wpl = Ci.nsIWebProgressListener;
          let aMaxTotalProgress = (aCurTotalProgress == -1 ? -1 : 100);
          let aTabListener = gBrowser.mTabListeners[mTabs[i]._tPos];
          let aWebProgress = mTabs[i].linkedBrowser.webProgress;
          let aRequest = Services.io.newChannelFromURI(mTabs[i].linkedBrowser.currentURI);
          let aStateFlags = (aCurTotalProgress == -1 ? wpl.STATE_STOP : wpl.STATE_START) | wpl.STATE_IS_NETWORK;
          aTabListener.onStateChange(aWebProgress, aRequest, aStateFlags, 0);
          aTabListener.onProgressChange(aWebProgress, aRequest, 0, 0, aCurTotalProgress, aMaxTotalProgress);
          mTabs[i].mProgress = aCurTotalProgress;
        }
      }
    }
  }
};

COBA.onIEProgressChange = function(event) {
  let progress = parseInt(event.detail);
  if (progress == 0) {
    gBrowser.userTypedValue = null;
  }
  COBA.updateProgressStatus();
  COBA.updateAll();
};

COBA.onNewIETab = function(event) {
  let data = JSON.parse(event.detail);
  let url = data.url;
  let id = data.id;
  let tab = COBA.addIeTab(url);
  let param = {id: id};
  COBA.setTabAttributeJSON(tab, COBA.navigateParamsAttr, param);
};

COBA.onSecurityChange = function(security) {
  COBA.updateSecureLockIcon();
};

/** 异步调用plugin的方法*/
COBA.goDoCommand = function(cmd) {
  try {
    let pluginObject = COBA.getPluginObject();
    if (pluginObject == null) {
      return false;
    }
    switch (cmd) {
      case 'Back':
        if (!pluginObject.CanBack) {
          return false;
        }
        break;
      case 'Forward':
        if (!pluginObject.CanForward) {
          return false;
        }
        break;
      }
      window.setTimeout(function() {
        COBA.delayedGoDoCommand(cmd);
      }, 100);
    return true;
  } catch (ex) {}
  return false;
};

COBA.delayedGoDoCommand = function(cmd) {
  try {
    let pluginObject = COBA.getPluginObject();
    switch (cmd) {
      case 'Back':
        pluginObject.Back();
        break;
      case 'Forward':
        pluginObject.Forward();
        break;
      case 'Stop':
        pluginObject.Stop();
        break;
      case 'Refresh':
        pluginObject.Refresh();
        break;
      case 'SaveAs':
        pluginObject.SaveAs();
        break;
      case 'Print':
        pluginObject.Print();
        break;
      case 'PrintSetup':
        pluginObject.PrintSetup();
        break;
      case 'PrintPreview':
        pluginObject.PrintPreview();
        break;
      case 'Find':
        pluginObject.Find();
        break;
      case 'cmd_cut':
        pluginObject.Cut();
        break;
      case 'cmd_copy':
        pluginObject.Copy();
        break;
      case 'cmd_paste':
        pluginObject.Paste();
        break;
      case 'cmd_selectAll':
        pluginObject.SelectAll();
        break;
      case 'Focus':
        pluginObject.Focus();
        break;
      case 'HandOverFocus':
        pluginObject.HandOverFocus();
        break;
      case 'Zoom':
        var zoomLevel = COBA.getZoomLevel();
        pluginObject.Zoom(zoomLevel);
        break;
      case 'DisplaySecurityInfo':
        pluginObject.DisplaySecurityInfo();
      break;
    }
  } catch (ex) {
  } finally {
    window.setTimeout(function() {
      COBA.updateAll();
    }, 0);
  }
};

COBA.closeTab = function(index) {
  var mTabs = gBrowser.mTabContainer.childNodes;
  gBrowser.removeTab(mTabs[index]);
};

COBA.getContextTab = function() {
  return gBrowser && gBrowser.mContextTab && gBrowser.mContextTab.localName == 'tab' ? gBrowser.mContextTab : null;
};

COBA.clickSwitchButton = function(e) {
  // Left or middle mouse button clicking
  if (e.button <= 1 && !e.target.disabled) {
    let aTab = gBrowser.mCurrentTab;
    if (!aTab) return;
    COBA.switchTabEngine(aTab);
  }

  // Right mouse button clicking
  else if (e.button == 2) {
    document.getElementById('coba-switch-button-context-menu').openPopup(e.target, 'after_start', 0, 0, true, false);
  }

  e.preventDefault();
};

COBA.focusIE = function() {
  COBA.goDoCommand('Focus');
};

COBA.onTabSelected = function(e) {
  COBA.updateAll();
  COBA.focusIE();
};

COBA.switchToIEByDoc = {
  // nsISupports
  QueryInterface: function(iid) {
    if (iid.equals(Ci.nsISupports) ||
      iid.equals(Ci.nsIObserver)) {
      return this;
    }
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  // nsIObserver
  observe: function(subject, topic, data) {
    let tab = COBA.getTabByDocument(subject);
    tab && COBA.switchTabEngine(tab);
  },
};

COBA.getTabByDocument = function(doc) {
  var mTabs = gBrowser.mTabContainer.childNodes;
  for (var i = 0; i < mTabs.length; i++) {
    var tab = mTabs[i];
    if (tab.linkedBrowser.contentDocument == doc) {
      return tab
    }
  }
  return null;
};

COBA.onPageShowOrLoad = function(e) {
  COBA.updateAll();

  let doc = e.originalTarget;

  let tab = COBA.getTabByDocument(doc);
  if (!tab) return;

  let zoomLevelParams = COBA.getTabAttributeJSON(tab, 'zoom');
  if (zoomLevelParams) {
    COBA.setZoomLevel(zoomLevelParams.zoomLevel);
    tab.removeAttribute(tab, 'zoom');
  }
};

COBA.getTabAttributeJSON =  function(tab, name) {
  let attrString = tab.getAttribute(name);
  if (!attrString) {
    return null;
  }

  try {
    let json = JSON.parse(attrString);
    return json;
  } catch (ex) {
    cobaUtils.LOG('COBA.getTabAttributeJSON:' + ex);
  }

  return null;
};

COBA.setTabAttributeJSON = function(tab, name, value) {
  let attrString = JSON.stringify(value);
  tab.setAttribute(name, attrString);
};

COBA.onResize = function(e) {
  COBA.goDoCommand('Zoom');
};

COBA.hookBrowserGetter = function(aBrowser) {
  if (aBrowser.localName != 'browser') {
    aBrowser = aBrowser.getElementsByTagNameNS(kXULNS, 'browser')[0];
  }
  // hook aBrowser.currentURI, 在IE引擎内部打开URL时, Firefox也能获取改变后的URL
  COBA.hookProp(aBrowser, 'currentURI', function() {
    let uri = COBA.getCurrentIeTabURI(this);
    if (uri) return uri;
  });
  COBA.hookProp(aBrowser, 'sessionHistory', function() {
    let history = this.webNavigation.sessionHistory;
    let uri = COBA.getCurrentIeTabURI(this);
    if (uri) {
      let entry = history.getEntryAtIndex(history.index, false);
      if (entry.URI.spec != uri.spec) {
        entry.QueryInterface(Ci.nsISHEntry).setURI(uri);
        if (this.parentNode.__SS_data) delete this.parentNode.__SS_data;
      }
    }
  });
};

COBA.hookURLBarSetter = function(aURLBar) {
  if (!aURLBar)
    aURLBar = document.getElementById('urlbar');
  if (!aURLBar)
    return;
  aURLBar.onclick = function(e) {
    let pluginObject = COBA.getPluginObject();
    if (pluginObject) {
      COBA.goDoCommand('HandOverFocus');
    }
  }

  COBA.hookProp(aURLBar, 'value', null, function() {
    this.isModeIE = arguments[0] && (arguments[0].substr(0, COBA.containerUrl.length) == COBA.containerUrl);
    if (this.isModeIE) {
      arguments[0] = COBA.getActualUrl(arguments[0]);
      // if (arguments[0] == "about:blank") arguments[0] = "";
    }
  });
};

COBA.hookCodeAll = function() {
  //hook properties
  COBA.hookBrowserGetter(gBrowser.mTabContainer.firstChild.linkedBrowser);
  COBA.hookURLBarSetter(gURLBar);

  let orgiBookmarkPage = PlacesCommandHook.bookmarkPage;
  PlacesCommandHook.bookmarkPage = function() {
    let args = [].slice.call(arguments);
    let browser = args.shift();
    let proxy = new Proxy(browser, {
      get: function(target, name) {
        if (name == 'currentURI') {
          return makeURI(COBA.getActualUrl(target.currentURI.spec));
        } else {
          return target[name];
        }
      }
    });
    args.unshift(proxy);
    return orgiBookmarkPage.apply(PlacesCommandHook, args);
  };

  // COBA.hookCode("BookmarkingUI.updateStarState", /(gBrowser|getBrowser\(\))\.currentURI/g, "makeURI(COBA.getActualUrl($&.spec))");
  let orgiUpdateStarState = BookmarkingUI.updateStarState;
  BookmarkingUI.updateStarState = function() {
    BookmarkingUI.__defineSetter__('_uri', function(newURI) {
      delete this._uri;
      this._uri = makeURI(COBA.getActualUrl(newURI.spec));
    });

    return orgiUpdateStarState.apply(BookmarkingUI);
  };

  // COBA.hookCode("gBrowser.addTab", "return t;", "COBA.hookBrowserGetter(t.linkedBrowser); $&");
  let origAddTab = gBrowser.addTab;
  gBrowser.addTab = function() {
    let tab = origAddTab.apply(gBrowser, arguments);
    COBA.hookBrowserGetter(tab.linkedBrowser);
    return tab;
  };

  // COBA.hookCode("gBrowser.setTabTitle", "if (browser.currentURI.spec) {", "$& if (browser.currentURI.spec.indexOf(COBA.containerUrl) == 0) return;"); // 取消原有的Tab标题文字设置
  let orgiSetTabTitle = gBrowser.setTabTitle;
  gBrowser.setTabTitle = function(aTab) {
    var browser = this.getBrowserForTab(aTab);
    var title = browser.contentTitle;
    if (!title && browser.currentURI.spec && browser.currentURI.spec.indexOf(COBA.containerUrl) == 0) return false;
    return orgiSetTabTitle.apply(gBrowser, arguments);
  };

  // COBA.hookCode("getShortcutOrURI", /return (\S+);/g, "return COBA.getHandledURL($1);"); // 访问新的URL

  //hook Interface Commands
  // COBA.hookCode("BrowserBack", /{/, "$& if(COBA.goDoCommand('Back')) return;");
  let orgiBrowserBack = BrowserBack;
  BrowserBack = function() {
    if(COBA.goDoCommand('Back')) return;
    return orgiBrowserBack();
  };

  // COBA.hookCode("BrowserForward", /{/, "$& if(COBA.goDoCommand('Forward')) return;");
  let origBrowserForward = BrowserForward;
  BrowserForward = function() {
    if(COBA.goDoCommand('Forward')) return;
    return origBrowserForward();
  };

  // COBA.hookCode("BrowserStop", /{/, "$& if(COBA.goDoCommand('Stop')) return;");
  let origBrowserStop = BrowserStop;
  BrowserStop = function() {
    if(COBA.goDoCommand('Stop')) return;
    return origBrowserStop();
  };

  // COBA.hookCode("BrowserReload", /{/, "$& if(COBA.goDoCommand('Refresh')) return;");
  let origBrowserReload = BrowserReload;
  BrowserReload = function() {
    if(COBA.goDoCommand('Refresh')) return;
    return origBrowserReload();
  };

  // COBA.hookCode("BrowserReloadSkipCache", /{/, "$& if(COBA.goDoCommand('Refresh')) return;");
  let origBrowserReloadSkipCache = BrowserReloadSkipCache;
  BrowserReloadSkipCache = function() {
    if(COBA.goDoCommand('Refresh')) return;
    return origBrowserReloadSkipCache();
  };

  // COBA.hookCode("saveDocument", /{/, "$& if(COBA.goDoCommand('SaveAs')) return;");
  let orgiSaveDocument = saveDocument;
  saveDocument = function() {
    if(COBA.goDoCommand('SaveAs')) return;
    return orgiSaveDocument();
  };

  // COBA.hookCode("MailIntegration.sendMessage", /{/, "$& var pluginObject = COBA.getPluginObject(); if(pluginObject){ arguments[0]=pluginObject.URL; arguments[1]=pluginObject.Title; }"); // @todo 发送邮件？
  let origSendMessage = MailIntegration.sendMessage;
  MailIntegration.sendMessage = function() {
    var pluginObject = COBA.getPluginObject();
    if (pluginObject) {
      arguments[0] = pluginObject.URL;
      arguments[1]=pluginObject.Title;
    }
    return origSendMessage.apply(MailIntegration, arguments);
  };

  // COBA.hookCode("PrintUtils.print", /{/, "$& if(COBA.goDoCommand('Print')) return;");
  let origPrint = PrintUtils.print;
  PrintUtils.print = function() {
    if(COBA.goDoCommand('Print')) return;
    return origPrint.apply(PrintUtils, arguments);
  };

  // COBA.hookCode("PrintUtils.showPageSetup", /{/, "$& if(COBA.goDoCommand('PrintSetup')) return;");
  let origShowPageSetup = PrintUtils.showPageSetup;
  PrintUtils.showPageSetup = function() {
    if(COBA.goDoCommand('PrintSetup')) return;
    return origShowPageSetup.apply(PrintUtils, arguments);
  };

  // COBA.hookCode("PrintUtils.printPreview", /{/, "$& if(COBA.goDoCommand('PrintPreview')) return;");
  let origPrintPreview = PrintUtils.printPreview;
  PrintUtils.printPreview = function() {
    if(COBA.goDoCommand('PrintPreview')) return;
    return origPrintPreview.apply(PrintUtils, arguments);
  };

  // COBA.hookCode("goDoCommand", /{/, "$& if(COBA.goDoCommand(arguments[0])) return;"); // cmd_cut, cmd_copy, cmd_paste, cmd_selectAll
  let origGoDoCommand = goDoCommand;
  goDoCommand = function() {
    if(COBA.goDoCommand(arguments[0])) return;
    return origGoDoCommand();
  };

  COBA.hookAttr("cmd_find", "oncommand", "if(COBA.goDoCommand('Find')) return;");
  COBA.hookAttr("cmd_findAgain", "oncommand", "if(COBA.goDoCommand('Find')) return;");
  COBA.hookAttr("cmd_findPrevious", "oncommand", "if(COBA.goDoCommand('Find')) return;");

  // COBA.hookCode("displaySecurityInfo", /{/, "$& if(COBA.goDoCommand('DisplaySecurityInfo')) return;");
  let origDisplaySecurityInfo = displaySecurityInfo;
  displaySecurityInfo = function() {
    if(COBA.goDoCommand('DisplaySecurityInfo')) return;
    return origDisplaySecurityInfo();
  };
};


COBA.addEventAll = function() {
  Services.obs.addObserver(COBA.HttpObserver, 'http-on-modify-request', false);
  COBA.CookieObserver.register();
  COBA.Observer.register();
  COBA.addEventListener('tabContextMenu', 'popupshowing', COBA.updateTabMenu);

  COBA.addEventListener(window, 'DOMContentLoaded', COBA.onPageShowOrLoad);
  COBA.addEventListener(window, 'pageshow', COBA.onPageShowOrLoad);
  COBA.addEventListener(window, 'resize', COBA.onResize);

  COBA.addEventListener(gBrowser.tabContainer, 'TabSelect', COBA.onTabSelected);

  COBA.addEventListener('menu_EditPopup', 'popupshowing', COBA.updateEditMenuItems);

  COBA.addEventListener(window, 'IeProgressChanged', COBA.onIEProgressChange);
  COBA.addEventListener(window, 'NewIETab', COBA.onNewIETab);
  Services.obs.addObserver(COBA.switchToIEByDoc, 'COBA-swith-to-ie', false);
};

COBA.removeEventAll = function() {
  Services.obs.removeObserver(COBA.HttpObserver, 'http-on-modify-request');
  COBA.CookieObserver.unregister();
  COBA.Observer.unregister();

  COBA.removeEventListener('tabContextMenu', 'popupshowing', COBA.updateTabMenu);

  COBA.removeEventListener(window, 'DOMContentLoaded', COBA.onPageShowOrLoad);
  COBA.removeEventListener(window, 'pageshow', COBA.onPageShowOrLoad);
  COBA.removeEventListener(window, 'resize', COBA.onResize);

  COBA.removeEventListener(gBrowser.tabContainer, 'TabSelect', COBA.onTabSelected);

  COBA.removeEventListener('menu_EditPopup', 'popupshowing', COBA.updateEditMenuItems);

  COBA.removeEventListener(window, 'ProgressChanged', COBA.onIEProgressChange);
  COBA.removeEventListener(window, 'NewIETab', COBA.onNewIETab);
  Services.obs.removeObserver(COBA.switchToIEByDoc, 'COBA-swith-to-ie');
};

COBA.init = function() {
  COBA.removeEventListener(window, 'load', COBA.init);
  if (!!document.getElementById('urlbar-container')) {
    COBA.initNow();
  } else {
    COBA.initLater();
  }

  // Clear IE compat mode settings
  let wrk = Cc['@mozilla.org/windows-registry-key;1'].createInstance(Ci.nsIWindowsRegKey);
  wrk.open(wrk.ROOT_KEY_CURRENT_USER, 'SOFTWARE\\Microsoft\\Internet Explorer\\Main\\FeatureControl\\FEATURE_BROWSER_EMULATION', wrk.ACCESS_ALL);
  try {
    wrk.removeValue('firefox.exe');
    wrk.removeValue('plugin-container.exe');
  } catch(e) {}
};

COBA.initDone = false;

COBA.initLater = function() {
  let self = COBA;
  self.initDone = false;
  let navbar = document.getElementById('nav-bar');
  if (!navbar)
    return;

  if (window.MutationObserver) {
    let observer = new MutationObserver(function(mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type != 'attributes' ||
            mutation.target != navbar ||
            mutation.attributeName != 'currentset') {
          return;
        }

        if (!!document.getElementById('urlbar-container')) {
          self.initNow();
        }
      });
    });

    let config = {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['currentset']
    };
    observer.observe(navbar, config);
  }
};

COBA.initNow = function() {
  if (COBA.initDone)
    return;
  COBA.initDone = true;
//  setTimeout(function() {
//    if (gBrowser.currentURI.spec != "about:blank")
//      return;
//    gBrowser.contentDocument.documentElement.focus();
//    window.focusAndSelectUrlBar()
//  },800)

  /**
   * navigator.plugins方法将使得最新安装的插件可用，更新相关数组，如 plugins 数组，并可选重新装入包含插件的已打开文档。
   * 你可以使用下列语句调用该方法：
   * navigator.plugins.refresh(true)
   * navigator.plugins.refresh(false)
   * 如果你给定 true 的话，refresh 将在使得新安装的插件可用的同时，重新装入所有包含有嵌入对象(EMBED 标签)的文档。
   *如果你给定 false 的话，该方法则只会刷新 plugins 数组，而不会重新载入任何文档。
   * 当用户安装插件后，该插件将不会可用，除非调用了 refresh，或者用户关闭并重新启动了 Navigator。
   */
  navigator.plugins.refresh(false);

  // 创建同步Cookie的plugin
//  let item = document.createElementNS("http://www.w3.org/1999/xhtml", "html:embed");
//  item.hidden = true;
//  item.setAttribute("id", "coba-cookie-object");
//  item.setAttribute("type", "application/coba");
//  let mainWindow = document.getElementById("main-window");
//  mainWindow.appendChild(item);

  COBA.hookCodeAll();
  COBA.addEventAll();
  COBA.updateAll();

  COBA.setupShortcut();
  COBA.setupUrlBar();
};

COBA.destroy = function() {
  COBA.removeEventListener(window, 'unload', COBA.destroy);

  COBA.removeEventAll();
};

// 设置内核切换快捷键
COBA.setupShortcut = function() {
  try {
    let keyItem = document.getElementById('key_cobaToggle');
    if (keyItem) {
      // Default key is "C"
      keyItem.setAttribute('key', Preferences.get('extensions.coba.shortcut.key', 'C'));
      // Default modifiers is "alt"
      keyItem.setAttribute('modifiers', Preferences.get('extensions.coba.shortcut.modifiers', 'alt'));
    }
  } catch (e) {
    cobaUtils.ERROR(e);
  }
};

COBA.setupUrlBar = function() {
  let showUrlBarLabel = Preferences.get('extensions.coba.showUrlBarLabel', true);
  document.getElementById('coba-urlbar-switch-label').hidden = !showUrlBarLabel;
  let btn_identity = document.getElementById('identity-box');
  btn_identity && btn_identity.addEventListener('click', COBA.clickFavIcon, false);
  let btn_urlbar_icon = document.getElementById('coba-urlbar-icon');
  btn_urlbar_icon && btn_urlbar_icon.addEventListener('click', COBA.clickUrlbarIcon, false);
};

COBA.clickFavIcon = function (e) {
  COBA.track({key: 'click', value: 'favicon'})
  COBA.showPanel(e)
};

COBA.clickUrlbarIcon = function (e) {
  COBA.track({key: 'click', value: 'urlbar'})
  COBA.showPanel(e)
};

// identity-box事件
COBA.showPanel = function (e) {
  if (e.button == 0) {
    let location = gBrowser.contentWindow.location;

    if (location.href.indexOf(COBA.containerUrl) == 0) {
      COBA.notify(e.originalTarget);
    }
  }

  e.preventDefault();
};

COBA.notify = function (ele) {
  let panel = document.getElementById('coba-identity-popup');
  panel.openPopup(ele);
};

COBA.hideNotify = function () {
  let panel = document.getElementById('coba-identity-popup');
  panel.hidePopup();
};

const PREF_BRANCH = 'extensions.coba.';

/**
 * Observer monitering the preferences.
 */
COBA.Observer = {
  _branch: null,

  observe: function(subject, topic, data) {
    if (topic === 'nsPref:changed') {
      let prefName = PREF_BRANCH + data;
      if (prefName.indexOf('shortcut.') != -1) {
        COBA.setupShortcut();
      } else if (prefName === 'extensions.coba.showUrlBarLabel') {
        COBA.setupUrlBar();
      }
    }
  },

  register: function() {
    this._branch = Services.prefs.getBranch(PREF_BRANCH);
    if (this._branch) {
      // Now we queue the interface called nsIPrefBranch2. This interface is described as:
      // "nsIPrefBranch2 allows clients to observe changes to pref values."
      this._branch.QueryInterface(Ci.nsIPrefBranch2);
      this._branch.addObserver('', this, false);
    }
  },

  unregister: function() {
    if (this._branch) {
      this._branch.removeObserver('',  this);
    }
  }
};

COBA.identityPopupShown = function() {
  document.getElementById('coba-identity-popup-more-info-button').focus();
  COBA.checkAlwaysUseIE();
};

COBA.checkAlwaysUseIE = function() {
  /* anything to consider before using getActualUrl ? */
  let url = COBA.getActualUrl(gBrowser.currentURI.spec);
  let list = '';
  try {
    list = Preferences.get('extensions.coba.filterlist', '');
  } catch(e) {};
  list = list.split(' ');
  let enabledIndex = list.indexOf(url);
  let checkbox = document.getElementById('coba-identity-popup-always-ie-checkbox');

  checkbox.checked = (enabledIndex > -1);
};

COBA.toggleAlwaysUseIE = function() {
  let url = COBA.getActualUrl(gBrowser.currentURI.spec);
  let list = '';
  try {
    list = Preferences.get('extensions.coba.filterlist', '');
  } catch(e) {};
  list = list.split(' ');
  let disabledIndex = list.indexOf(url + '\b');
  let enabledIndex = list.indexOf(url);
  let checkbox = document.getElementById('coba-identity-popup-always-ie-checkbox');

  if (checkbox.checked) {
    if (disabledIndex > -1) {
      list.splice(disabledIndex, 1, url);
    } else if (enabledIndex == -1) {
      list.push(url);
    }
    list.sort();

    COBA.track({key: 'always', value: encodeURIComponent(url.split('?')[0])});
  } else {
    if (enabledIndex > -1) {
      list.splice(enabledIndex, 1);
    }
  }
  try {
    Preferences.set('extensions.coba.filterlist', list.join(' '));
  } catch(e) {};
};

window.addEventListener('load', COBA.init, false);
window.addEventListener('unload', COBA.destroy, false);
COBA.engineAttr = 'cobaEngine';
