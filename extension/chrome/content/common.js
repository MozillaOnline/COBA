/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://coba/cobaUtils.jsm');

var COBA = COBA || {};

COBA.containerUrl = 'chrome://coba/content/container.xhtml?url=';
COBA.navigateParamsAttr = 'cobaNavigateParams';
COBA.objectID = 'coba-object';

COBA.isValidURL = function (url) {
  let b = false;
  try {
    let uri = Services.io.newURI(url, null, null);
    b = true;
  } catch (e) {
    cobaUtils.ERROR(e);
  }
  return b;
};

COBA.isValidDomainName = function (domainName) {
  return /^[0-9a-zA-Z]+[0-9a-zA-Z\.\_\-]*\.[0-9a-zA-Z\_\-]+$/.test(domainName);
};

COBA.getActualUrl = function(url) {
  if (url && url.length > 0) {
    url = url.replace(/^\s+/g, '').replace(/\s+$/g, '');
    if (/^file:\/\/.*/.test(url)) url = url.replace(/\|/g, ':');
    if (url.substr(0, COBA.containerUrl.length) == COBA.containerUrl) {
      url = decodeURI(url.substring(COBA.containerUrl.length));

      if (!/^[\w]+:/.test(url)) {
        url = 'http://' + url;
      }
    }
  }
  return url;
};

COBA.getChromeWindow = function () {
  return Services.wm.getMostRecentWindow('navigator:browser');
};

// IE doen't support Text Zoom, only support Full Zoom
COBA.getZoomLevel = function () {
  let aBrowser = (typeof (gBrowser) == 'undefined') ? COBA.getChromeWindow().gBrowser : gBrowser;
  let docViewer = aBrowser.selectedBrowser.markupDocumentViewer;
  let zoomLevel = docViewer.fullZoom;
  return zoomLevel;
};

COBA.setZoomLevel = function (value) {
  let aBrowser = (typeof (gBrowser) == 'undefined') ? COBA.getChromeWindow().gBrowser : gBrowser;
  let docViewer = aBrowser.selectedBrowser.markupDocumentViewer;
  docViewer.fullZoom = value;
};

COBA.addEventListener = function (obj, type, listener) {
  if (typeof (obj) == 'string') {
    obj = document.getElementById(obj);
  }
  if (obj) {
    obj.addEventListener(type, listener, false);
  }
};

COBA.removeEventListener = function (obj, type, listener) {
  if (typeof (obj) == 'string') {
    obj = document.getElementById(obj);
  }
  if (obj) {
    obj.removeEventListener(type, listener, false);
  }
};

COBA.addEventListenerByTagName = function (tag, type, listener) {
  let objs = document.getElementsByTagName(tag);
  for (let i = 0; i < objs.length; i++) {
    objs[i].addEventListener(type, listener, false);
  }
};

COBA.removeEventListenerByTagName = function (tag, type, listener) {
  let objs = document.getElementsByTagName(tag);
  for (let i = 0; i < objs.length; i++) {
    objs[i].removeEventListener(type, listener, false);
  }
};

// Replace attribute value V with myFunc + V
COBA.hookAttr = function (parentNode, attrName, myFunc) {
  if (typeof (parentNode) == 'string') {
    parentNode = document.getElementById(parentNode);
  }
  try {
    parentNode.setAttribute(attrName, myFunc + parentNode.getAttribute(attrName));
  } catch (e) {
    cobaUtils.ERROR('Failed to hook attribute: ' + attrName);
  }
};

COBA.hookProp = function (parentNode, propName, myGetter, mySetter) {
  let oGetter = parentNode.__lookupGetter__(propName);
  let oSetter = parentNode.__lookupSetter__(propName);
  if (oGetter && myGetter) myGetter = oGetter.toString().replace(/{/, '{' + myGetter.toString().replace(/^.*{/, '').replace(/.*}$/, ''));
  if (oSetter && mySetter) mySetter = oSetter.toString().replace(/{/, '{' + mySetter.toString().replace(/^.*{/, '').replace(/.*}$/, ''));
  if (!myGetter) myGetter = oGetter;
  if (!mySetter) mySetter = oSetter;
  if (myGetter) try {
    eval('parentNode.__defineGetter__(propName, ' + myGetter.toString() + ');');
  } catch (e) {
    cobaUtils.ERROR('Failed to hook property Getter: ' + propName);
  }
  if (mySetter) try {
    eval('parentNode.__defineSetter__(propName, ' + mySetter.toString() + ');');
  } catch (e) {
    cobaUtils.ERROR('Failed to hook property Setter: ' + propName);
  }
};

COBA.startsWith = function (s, prefix) {
  if (s) return ((s.substring(0, prefix.length) == prefix));
  else return false;
};

COBA.endsWith = function (s, suffix) {
  if (s && (s.length > suffix.length)) {
    return (s.substring(s.length - suffix.length) == suffix);
  } else return false;
};

COBA.getDefaultCharset = function (defval) {
  let charset = this.getCharPref('extensions.coba.intl.charset.default', '');
  if (charset.length) return charset;
  if (Services.prefs.prefHasUserValue('intl.charset.default')) {
    return Services.prefs.getCharPref('intl.charset.default');
  } else {
    let strBundle = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
    let intlMess = strBundle.createBundle('chrome://global-platform/locale/intl.properties');
    try {
      return intlMess.GetStringFromName('intl.charset.default');
    } catch (e) {
      cobaUtils.WARN(e);
      return defval;
    }
  }
};

COBA.queryDirectoryService = function (aPropName) {
  try {
    let dirService = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);
    let file = dirService.get(aPropName, Ci.nsIFile);
    return file.path;
  } catch (e) {cobaUtils.ERROR(e)}

  return null;
};

COBA.convertToUTF8 = function (data, charset) {
  try {
    data = decodeURI(data);
  } catch (e) {
    cobaUtils.WARN('convertToUTF8 faild');
    if (!charset) charset = COBA.getDefaultCharset();
    if (charset) {
      let uc = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
      try {
        uc.charset = charset;
        data = uc.ConvertToUnicode(unescape(data));
        data = decodeURI(data);
      } catch (e) {cobaUtils.ERROR(e)}
      uc.Finish();
    }
  }
  return data;
};

COBA.convertToASCII = function (data, charset) {
  if (!charset) charset = COBA.getDefaultCharset();
  if (charset) {
    let uc = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
    uc.charset = charset;
    try {
      data = uc.ConvertFromUnicode(data);
    } catch (e) {
      cobaUtils.WARN('ConvertFromUnicode faild');
      data = uc.ConvertToUnicode(unescape(data));
      data = decodeURI(data);
      data = uc.ConvertFromUnicode(data);
    }
    uc.Finish();
  }
  return data;
};

COBA.getUrlDomain = function (url) {
  let r = '';
  if (url && !COBA.startsWith(url, 'about:')) {
    if (/^file:\/\/.*/.test(url)) r = url;
    else {
      try {
        var uri = Services.io.newURI(url, null, null);
        uri.path = '';
        r = uri.spec;
      } catch (e) {cobaUtils.ERROR(e)}
    }
  }
  return r;
};

COBA.getUrlHost = function (url) {
  if (url && !COBA.startsWith(url, 'about:')) {
    if (/^file:\/\/.*/.test(url)) return url;
    let matches = url.match(/^([A-Za-z]+:\/+)*([^\:^\/]+):?(\d*)(\/.*)*/);
    if (matches) url = matches[2];
  }
  return url;
};
