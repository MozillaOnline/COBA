/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let EXPORTED_SYMBOLS = ['cobaUtils'];
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://coba/logger.jsm');

let cobaUtils = {
  getTabAttributeJSON: function(tab, name) {
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
  },

  getChromeWindow: function() {
    let chromeWin = Services.wm.getMostRecentWindow('navigator:browser');
    return chromeWin;
  },

  setTabAttributeJSON: function(tab, name, value) {
    let attrString = JSON.stringify(value);
    tab.setAttribute(name, attrString);
  },

  getTabFromDocument: function(doc) {
    let aBrowser = this.getChromeWindow().gBrowser;
    if (!aBrowser.getBrowserIndexForDocument) return null;
    try {
      let tab = null;
      let targetBrowserIndex = aBrowser.getBrowserIndexForDocument(doc);

      if (targetBrowserIndex != -1) {
        tab = aBrowser.tabContainer.childNodes[targetBrowserIndex];
        return tab;
      }
    } catch (err) {
      cobaUtils.ERROR(err);
    }
    return null;
  },

  getTabFromWindow: function(win) {
    function getRootWindow(win) {
      for (; win; win = win.parent) {
        if (!win.parent || win == win.parent || !(win.parent instanceof Ci.nsIDOMWindow))
          return win;
      }

      return null;
    }
    let aWindow = getRootWindow(win);

    if (!aWindow || !aWindow.document)
      return null;

    return this.getTabFromDocument(aWindow.document);
  }

};

/**
 * Cache of commonly used string bundles.
 * Usage: cobaUtils.Strings.global.GetStringFromName("XXX")
 */
cobaUtils.Strings = {};
[
  ['global', 'chrome://coba/locale/global.properties'], ].forEach(function(aStringBundle) {
  let[name, bundle] = aStringBundle;
  XPCOMUtils.defineLazyGetter(cobaUtils.Strings, name, function() {
    return Services.strings.createBundle(bundle);
  });
});

/**
 * Set the value of preference "extensions.logging.enabled" to false to hide
 * cobaUtils.LOG message
 */
Logger.getLogger(cobaUtils);
