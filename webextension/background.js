var ContentListener = {
  async _onMessage(message, sender) {
    if (message.dir !== "content2bg") {
      return undefined;
    }

    let tabId = sender.tab.id;
    let details = message.details ||
                  WebRequestListener.getDetailsForTabId(tabId);
    switch (message.type) {
      case "ready":
        Utils.sendTrackingWithDetails(details, "load");

        return details;
      case "openInIe":
        Utils.sendTrackingWithDetails(details, "clickIe");

        return NativeHost.sendMessage(details);
      case "downloadHost":
        return NativeHost.downloadHost();
      case "stayInFx":
        Utils.sendTrackingWithDetails(details, "clickFx");

        Utils.whitelistUrl(details.url);
        await browser.tabs.update(tabId, { url: "about:blank" });
        return browser.tabs.update(tabId, { url: details.url });
      default:
        console.log(message);
        return undefined;
    }
  },

  init() {
    this.onMessage = this._onMessage.bind(this);
    browser.runtime.onMessage.addListener(this.onMessage);
  }
}

var NativeHost = {
  appId: "com.mozillaonline.cobahelper",
  debug: false,
  downloadId: null,
  downloadOptions: {
    url: "https://addons.firefox.com.cn/chinaedition/addons/cobahelper/coba-helper-setup.exe",
    conflictAction: "overwrite"
  },
  messages: {
    FAILURE: "Navigate IE failed: ",
    SUCCESS: "Navigate IE succeeded: "
  },
  port: null,

  get notInstalledMsg() {
    delete this.notInstalledMsg;
    return this.notInstalledMsg = `This extension does not have permission to use native application ${this.appId} (or the application is not installed)`;
  },

  async _onChanged(delta) {
    if (delta.id !== this.downloadId) {
      return;
    }
    if (!delta.state || delta.state.current !== "complete") {
      return;
    }
    browser.downloads.onChanged.removeListener(this.onChanged);

    await browser.downloads.show(this.downloadId);
    await browser.downloads.erase({ id: this.downloadId });
  },

  async _onDisconnect(port) {
    if (!port || !port.error) {
      return;
    }

    let data = { action: "disconnect" };
    switch (port.error.message) {
      case this.notInstalledMsg:
        if (await Utils.getPref("host.installed")) {
          data.succeeded = 0;
          data.retval = -2;
        } else {
          data.succeeded = 0;
          data.retval = -3;
        }
        break;
      default:
        console.error(port.error);
        break;
    }

    Utils.sendTracking({ data });
    this.cleanup();
  },

  cleanup() {
    this.port.onDisconnect.removeListener(this.onDisconnect);
    this.port = null;
  },

  async detect() {
    try {
      await this.sendMessage("ping");
    } catch (ex) {
      this.port = browser.runtime.connectNative(this.appId);
      this.port.onDisconnect.addListener(this.onDisconnect);
    }
  },

  async downloadHost() {
    this.downloadId = await browser.downloads.download(this.downloadOptions);
    browser.downloads.onChanged.addListener(this.onChanged);
    return this.downloadId;
  },

  init() {
    this.onChanged = this._onChanged.bind(this);
    this.onDisconnect = this._onDisconnect.bind(this);

    this.detect();
  },

  async sendMessage(msg) {
    if (this.port) {
      console.warn(`NativeHost.port should normally be null`);
      this.cleanup();
    }

    if (this.debug) {
      let msgAsString = JSON.stringify(msg, null, 2);
      console.log(`COBA => helper:\n${msgAsString}`);
    }
    let response = await browser.runtime.sendNativeMessage(this.appId, msg);
    if (this.debug) {
      console.log(`COBA <= helper:\n${response}`);
    }

    let data = { action: "navigation" };
    if (response.startsWith(this.messages.SUCCESS)) {
      data.succeeded = 1;
      data.retval = response.slice(this.messages.SUCCESS.length);
    } else if (response.startsWith(this.messages.FAILURE)) {
      data.succeeded = 0;
      data.retval = response.slice(this.messages.FAILURE.length);
    }
    if (data.succeeded !== undefined) {
      Utils.sendTracking({ data });
    }
  }
};

var Utils = {
  get defaultPrefs() {
    delete this.defaultPrefs;
    return this.defaultPrefs = {
      "builtin.enabled": true,
      "builtin.urllist": this.defaultUrlList,
      "builtin.update.enabled": true,
      "custom.enabled": true,
      "custom.urllist": [],
      "host.installed": false
    };
  },
  defaultUrlList: [
    // initial list from http://go.microsoft.com/fwlink/p/?LinkId=620451
    // a subset of the entries, those with trackingid 7668549
    "*://*.bankofbeijing.com.cn/*",
    "*://*.cmbc.com.cn/*",
    "*://*.spdb.com.cn/*",
    "*://*.hxb.com.cn/*",
    "*://*.cgbchina.com.cn/*",
    "*://*.bank.ecitic.com/*",
    "*://*.unionpay.com/*",
    "*://*.bankofshanghai.com/*",
    "*://*.icbc.com.cn/*",
    "*://*.ccb.com/*",
    "*://*.pingan.com/*",
    "*://*.pingan.com.cn/*",
    "*://*.95599.cn/*",
    "*://*.boc.cn/*",
    "*://*.abchina.com/*",
    "*://*.bankofchina.com/*",
    "*://*.psbc.com/*",
    "*://*.cib.com.cn/*",
    "*://*.bankcomm.com/*",
    "*://*.cebbank.com/*",
    "*://*.95516.com/*",
    "*://*.95559.com.cn/*",
    "*://*.cmbchina.com/*",
    // at the request of desktop QA
    "*://*.ccb.com.cn/*",
    // for test, submit the form at https://httpbin.org/forms/post
    "https://httpbin.org/post"
  ],
  disabledUrlFilters: {
    urls: new Set(),
    hostSuffixes: new Set()
  },
  enabledUrlFilters: {
    urls: new Set(),
    hostSuffixes: new Set()
  },

  cacheEnabledUrlFilters(rawUrlFilters) {
    for (let rawUrlFilter of rawUrlFilters) {
      try {
        new URL(rawUrlFilter);
        this.enabledUrlFilters.urls.add(rawUrlFilter);
      } catch (ex) {
        let matches = /\*:\/\/\*\.([^*/]+)\/\*/.exec(rawUrlFilter);
        if (matches) {
          this.enabledUrlFilters.hostSuffixes.add(matches[1]);
        } else {
          console.error(`Invalid url filter: ${rawUrlFilter}`);
        }
      }
    }
  },

  extractReferer(details, fallbackUrl = null) {
    let matches = /^referer:\s(.*)$/m.exec(details.request_headers);
    return matches ? matches[1] : fallbackUrl;
  },

  getHostFromUrl(url) {
    return (new URL(url)).host;
  },

  async getPref(key) {
    let prefs = await browser.storage.local.get(this.defaultPrefs);

    return prefs[key];
  },

  getUrlFilterForUrl(url, urlFilters) {
    if (urlFilters.urls.has(url)) {
      return { type: "urls", urlFilter: url };
    }

    let host = this.getHostFromUrl(url);
    for (let hostSuffix of urlFilters.hostSuffixes) {
      if (host === hostSuffix || host.endsWith(`.${hostSuffix}`)) {
        return { type: "hostSuffixes", urlFilter: hostSuffix };
      }
    }

    return null;
  },

  async getUrlsToFilter() {
    let prefs = await browser.storage.local.get(this.defaultPrefs),
        urls = [];

    if (prefs["builtin.enabled"]) {
      urls = urls.concat(prefs["builtin.urllist"]);
    }
    // if (prefs["builtin.update.enabled"]) {
    //   should trigger the update here
    // }
    if (prefs["custom.enabled"]) {
      urls = urls.concat(prefs["custom.urllist"]);
    }

    this.cacheEnabledUrlFilters(urls);

    return urls;
  },

  isUrlWhitelisted(url) {
    return !!this.getUrlFilterForUrl(url, this.disabledUrlFilters);
  },

  async sendTracking(tracking) {
    if (await this.canSendTracking()) {
      return this._sendTracking(tracking.data);
    }
      return false;

  },
  _sendTracking(rawData) {
    return new Promise(function(resolve, reject) {
      let usp = new URLSearchParams();
      for (let key in rawData) {
        usp.append(key, rawData[key]);
      }
      usp.append("random", Math.random());

      let url = "http://addons.g-fox.cn/coba-webext.gif";
      url += "?" + usp.toString();

      let xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onload = evt => resolve(evt.target.status);
      xhr.onloadend = () => reject();
      xhr.send();
    });
  },

  /**
   * @return {boolean}
   * @async
   * */
  async canSendTracking() {
    return browser.runtime.sendMessage(
      "cpmanager@mozillaonline.com",
      {type: "trackingEnabled"},
      {},
    ).then(
      v => Boolean(v && v.trackingEnabled),
      e => {
        console.error(e);
        return false;
      }
    );
  },

  sendTrackingWithDetails(details, action) {
    if (!details) {
      return Promise.reject();
    }

    let data = {
      action,
      method: (details.request_body ? "POST" : "GET"),
      // todo: add rawUrl and rawReferer key when https://bugzil.la/1315558 fixed
    };

    return this.sendTracking({ data });
  },

  async setPref(kvObj) {
    return browser.storage.local.set(kvObj);
  },

  whitelistUrl(url) {
    let ret = this.getUrlFilterForUrl(url, this.enabledUrlFilters);
    if (ret) {
      this.disabledUrlFilters[ret.type].add(ret.urlFilter);
    }
  }
}

var WebRequestListener = {
  detailsByTabId: new Map(),
  extraInfoSpec: [ "blocking", "requestBody" ],

  _onBeforeRequest(details) {
    if (details.frameId !== 0 ||
        details.method !== "GET" ||
        details.type !== "main_frame") {
      console.warn(details);
    }

    if (Utils.isUrlWhitelisted(details.url)) {
      return {};
    }

    this.detailsByTabId.set(details.tabId, this.normalizeDetails(details));

    // Using cancel + tabs.update here:
    // 1. a bug in redirection to in-extension page: https://bugzil.la/1256122
    // 2. redirectTo doesn't stop the original load immediately, causing the
    //    servers to receive the same post data from both Firefox and IE:
    //    https://bugzil.la/1345893
    let url = browser.extension.getURL("page/coba.html");
    browser.tabs.update(details.tabId, { url });
    return { cancel: true };
  },

  getDetailsForTabId(tabId) {
    let details = this.detailsByTabId.get(tabId);
    this.detailsByTabId.delete(tabId);

    return details;
  },

  async init() {
    this.onBeforeRequest = this._onBeforeRequest.bind(this);

    return this.startListener();
  },

  normalizeDetails(details) {
    let url = details.url;

    let requestHeaders = [];
    if (details.originUrl) {
      requestHeaders.push({
        name: "referer",
        value: details.originUrl
      });
    }

    let request_body = this.normalizeRequestBody(details.requestBody);
    if (request_body) {
      requestHeaders.push({
        name: "content-type",
        value: "application/x-www-form-urlencoded"
      });
    }
    let request_headers = this.normalizeRequestHeaders(requestHeaders);

    return { request_body, request_headers, url };
  },

  normalizeRequestBody(requestBody) {
    if (!requestBody) {
      return "";
    }

    if (requestBody.formData) {
      let usp = new URLSearchParams();
      for (let name of Object.keys(requestBody.formData)) {
        for (let val of requestBody.formData[name]) {
          usp.append(name, val);
        }
      }
      return usp.toString();
    }

    if (!requestBody.raw || requestBody.raw.length > 1) {
      return "";
    }

    // gbk encoded forms
    var decoder = new TextDecoder();
    try {
      return decoder.decode(requestBody.raw[0].bytes);
    } catch (ex) {
      return "";
    }
  },

  normalizeRequestHeaders(requestHeaders) {
    return requestHeaders.map(item => {
      return `${item.name}: ${item.value}\r\n`;
    }).join("");
  },

  async startListener() {
    let listener = this.onBeforeRequest,
        onBeforeRequest = browser.webRequest.onBeforeRequest;
    if (onBeforeRequest.hasListener(listener)) {
      onBeforeRequest.removeListener(listener);
    }

    let filter = { "types": [ "main_frame" ] };
    filter.urls = await Utils.getUrlsToFilter();

    onBeforeRequest.addListener(listener, filter, this.extraInfoSpec);
  }
};

ContentListener.init();
NativeHost.init();
WebRequestListener.init().catch(ex => console.error(ex));
