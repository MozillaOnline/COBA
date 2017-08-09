const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Downloads",
  "resource://gre/modules/Downloads.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
  "resource://gre/modules/FileUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Preferences",
  "resource://gre/modules/Preferences.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Services",
  "resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Subprocess",
  "resource://gre/modules/Subprocess.jsm");

XPCOMUtils.defineLazyGetter(this, "CETracking", () => {
  try {
    return Cc["@mozilla.com.cn/tracking;1"].getService().wrappedJSObject;
  } catch (ex) {
    console.error(ex);
    return null;
  }
});

Cu.importGlobalProperties(["URLSearchParams", "XMLHttpRequest"]);

var COBA = {
  nativeHostInfo: {
    expectedCommonName: "Mozilla Online Limited",
    // switch to https before release
    source: "https://addons.firefox.com.cn/chinaedition/addons/cobahelper/coba-helper-setup.exe",
    get target() {
      let sourceURL = Services.io.newURI(this.source).QueryInterface(Ci.nsIURL);

      delete this.target;
      return this.target = FileUtils.getFile("TmpD", [sourceURL.fileName]);
    }
  },
  prefBranch: "extensions.coba.",

  // Returning a Promise instead of returning true + sendResponse
  // fails the `result instanceof this.context.cloneScope.Promise` test in
  // /toolkit/components/extensions/ExtensionChild.jsm, it seems
  _onMessage(message, sender, sendResponse) {
    if (message.dir != "bg2legacy") {
      return false;
    }

    switch (message.type) {
      case "install_host":
        this.installHost().then(sendResponse, sendResponse);
        return true;
      case "migrate_prefs":
        this.getLegacyPrefs().then(sendResponse, sendResponse);
        return true;
      case "send_tracking":
        this.sendTracking(message.data).then(sendResponse, sendResponse);
        return true;
      default:
        return false;
    }
  },

  // the majority of cases should be covered by these two types of listItems
  convertListItem(listItem) {
    if (listItem.endsWith("\b")) {
      return "";
    }

    try {
      let uri = Services.io.newURI(listItem);
      return uri.spec;
    } catch (ex) {}

    try {
      let matches = /^(\*\.[^*/]+)\*$/.exec(listItem);
      if (matches) {
        return `*://${matches[1]}/*`;
      }
    } catch (ex) {}

    return "";
  },

  // return undefined to avoid overriding earlier value with empty array
  convertList(list) {
    let converted = (list || "").split(" ").map(this.convertListItem);
    converted = converted.filter(listItem => !!listItem);
    return converted.length ? converted : undefined;
  },

  ensureSignedBy(signatureInfo, expectedCommonName) {
    if (!signatureInfo.length) {
      let message = "Installer has no signature.";
      throw new Downloads.Error({ message });
    }

    let certList = signatureInfo.queryElementAt(0, Ci.nsIX509CertList);
    // at least one cert should exist in the chain, right?
    let firstCert = certList.getEnumerator().getNext().
      QueryInterface(Ci.nsIX509Cert);
    if (firstCert.commonName !== expectedCommonName) {
      let message = `Installer not signed by ${expectedCommonName}`;
      throw new Downloads.Error({ message });
    }
  },

  getBaseDomain(url) {
    return Services.eTLD.getBaseDomain(Services.io.newURI(url));
  },

  async getLegacyPrefs() {
    // we no longer define the default branch of these prefs
    let prefs = new Preferences(this.prefBranch);
    let legacyPrefs = {
      "builtin.enabled": prefs.get("official.filter"),
      "builtin.update.enabled": prefs.get("official.filter.update"),
      "custom.enabled": prefs.get("filter"),
      "custom.urllist": this.convertList(prefs.get("filterlist"))
    };
    prefs.resetBranch();

    return legacyPrefs;
  },

  init(browser) {
    this.onMessage = this._onMessage.bind(this);
    browser.runtime.onMessage.addListener(this.onMessage);
  },

  async installHost() {
    let download = await Downloads.createDownload(this.nativeHostInfo);
    await download.start();

    if (!download.succeeded) {
      throw (download.error || new Downloads.Error({
        message: "Unknown Error"
      }));
    }

    let signatureInfo = download.saver.getSignatureInfo();
    this.ensureSignedBy(signatureInfo, this.nativeHostInfo.expectedCommonName);

    // non-default stderr value to workaround https://bugzil.la/1371548 on Fx 54
    let proc = await Subprocess.call({
      command: (download.target && download.target.path),
      arguments: ["/S"],
      stderr: "stdout"
    });

    return proc.exitPromise;
  },

  sendTracking(rawData) {
    return new Promise((resolve, reject) => {
      if (!CETracking || !CETracking.ude) {
        reject();
        return;
      }

      let usp = new URLSearchParams();
      for (let key in rawData) {
        if (key.startsWith("raw")) {
          if (rawData[key]) {
            let newKey = key.slice("raw".length).toLowerCase();
            usp.append(newKey, this.getBaseDomain(rawData[key]));
          }
        } else {
          usp.append(key, rawData[key]);
        }
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
  }
};

var ConsoleListener = {
  messages: {
    FAILURE: "RegDeleteTreeW returns: ",
    SUCCESS: "RegDeleteTreeW succeeded"
  },
  get prefix() {
    let application = "com.mozillaonline.cobahelper";
    delete this.prefix;
    return this.prefix = `stderr output from native app ${application}: `;
  },
  _observe(msg) {
    if (msg.message.startsWith(this.prefix)) {
      let message = msg.message.slice(this.prefix.length);
      let data = { action: "regdel" };
      if (message.startsWith(this.messages.FAILURE)) {
        data.succeeded = 0;
        data.retval = message.slice(this.messages.FAILURE.length).trim();
      } else if (message === this.messages.SUCCESS) {
        data.succeeded = 1;
      }

      if (data.succeeded !== undefined) {
        COBA.sendTracking(data);
      }
    }
  },
  init() {
    this.observe = this._observe.bind(this);
    Services.console.registerListener(this);
  },
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIConsoleListener])
};

function install() {}
async function startup({ webExtension }) {
  ConsoleListener.init();
  let { browser } = await webExtension.startup();
  COBA.init(browser);
}
function shutdown() {}
function uninstall() {}
