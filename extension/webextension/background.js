var ContentListener = {
  _onMessage(message, sender, sendResponse) {
    if (message.dir !== "content2bg") {
      return;
    }

    // initially undefined for "ready"
    let details = message.details;
    let tabId = sender.tab.id;
    switch (message.type) {
      case "ready":
        details = WebRequestListener.getDetailsForTabId(tabId);
        sendResponse(details);

        Utils.sendTrackingWithDetails(details, "load");
        break;
      case "openInIe":
        NativePort.postMessage(details);

        Utils.sendTrackingWithDetails(details, "clickIe");
        break;
      case "stayInFx":
        Utils.whitelistUrl(details.url);

        let url = details.url;
        if (details.request_body) {
          url = Utils.extractReferer(details, url);
        }
        browser.tabs.update(tabId, { url: "about:blank" }).then(() => {
          return browser.tabs.update(tabId, { url });
        });

        Utils.sendTrackingWithDetails(details, "clickFx");
        break;
      default:
        console.log(message);
        break;
    }
  },

  init() {
    this.onMessage = this._onMessage.bind(this);
    browser.runtime.onMessage.addListener(this.onMessage);
  }
}

var NativePort = {
  application: "com.mozillaonline.cobahelper",
  debug: false,
  messages: {
    FAILURE: "Navigate IE failed: ",
    SUCCESS: "Navigate IE succeeded: "
  },
  port: null,

  get notInstalled() {
    delete this.notInstalled;
    return this.notInstalled = `This extension does not have permission to use native application ${this.application} (or the application is not installed)`;
  },

  async _onDisconnect(port) {
    if (!port || !port.error) {
      return;
    }

    let data = { action: "disconnect" };
    switch (port.error.message) {
      case this.notInstalled:
        try {
          let response = await Utils.sendLegacy({ type: "install_host" });
          if (!response || response.exitCode !== 0) {
            throw response;
          }

          this.connect();

          data.succeeded = 1;
          data.retval = 0;
        } catch(ex) {
          console.error(ex);

          data.succeeded = 0;
          data.retval = (ex && ex.exitCode) || -1;
        }
        break;
      default:
        console.error(port.error);
        // maybe retry or something like that?
        break;
    }

    Utils.sendTracking({ data });
  },

  _onMessage(response) {
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
  },

  connect() {
    if (this.port) {
      this.cleanup();
    }

    this.port = browser.runtime.connectNative(this.application);
    this.port.onDisconnect.addListener(this.onDisconnect);
    this.port.onMessage.addListener(this.onMessage);
  },

  cleanup() {
    this.port.onMessage.removeListener(this.onMessage);
    this.port.onDisconnect.removeListener(this.onDisconnect);
    this.port = null;
  },

  init() {
    this.onDisconnect = this._onDisconnect.bind(this);
    this.onMessage = this._onMessage.bind(this);

    this.connect();
  },

  postMessage(msg, retry = 1) {
    try {
      this.port.postMessage(msg);

      if (this.debug) {
        let msgAsString = JSON.stringify(msg, null, 2);
        console.log(`COBA => helper:\n ${msgAsString}`);
      }
    } catch(ex) {
      console.error(ex);

      if (retry > 0) {
        this.connect();
        this.postMessage(msg, retry - 1);
      }
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
      "custom.urllist": []
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
      } catch(ex) {
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

  async migratePrefs() {
    let legacyPrefs = await this.sendLegacy({ type: "migrate_prefs" });

    for (let key in legacyPrefs) {
      if (legacyPrefs[key] === undefined) {
        delete legacyPrefs[key];
      }
    }

    return browser.storage.local.set(legacyPrefs);
  },

  sendLegacy(msg) {
    msg.dir = "bg2legacy";
    return browser.runtime.sendMessage(msg);
  },

  sendTracking(tracking) {
    tracking.type = "send_tracking";
    return this.sendLegacy(tracking);
  },

  sendTrackingWithDetails(details, action) {
    if (!details) {
      return;
    }

    let data = {
      action,
      method: (details.request_body ? "POST" : "GET"),
      rawReferer: this.extractReferer(details),
      rawUrl: details.url
    };

    return this.sendTracking({ data });
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

    await Utils.migratePrefs();
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
    } catch(ex) {
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
NativePort.init();
WebRequestListener.init().catch(ex => console.error(ex));
