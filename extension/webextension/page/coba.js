(function() {
  let needIE = {
    details: null,
    get buttons() {
      let selector = "#netErrorButtonContainer > button";
      delete this.buttons;
      return this.buttons = document.querySelectorAll(selector);
    },
    get longDescItems() {
      let selector = "#errorLongDesc > ul > li"
      delete this.longDescItems;
      return this.longDescItems = document.querySelectorAll(selector);
    },
    get shortDesc() {
      delete this.shortDesc;
      return this.shortDesc = document.getElementById("errorShortDescText");
    },
    get title() {
      delete this.title;
      return this.title = document.querySelector("h1.title-text");
    },
    handleEvent(evt) {
      switch (evt.type) {
        case "click":
          this.send({ type: evt.target.id, details: this.details });
          break;
        case "DOMContentLoaded":
          this.init(evt);
          break;
        case "unload":
          this.uninit(evt);
          break;
        default:
          break;
      }
    },
    async init(evt) {
      this.details = await this.send({ type: "ready" });

      this.initWithDetails();
    },
    initWithDetails() {
      this.initI18ns();

      if (!this.details || !this.details.url) {
        return;
      }

      for (let button of this.buttons) {
        button.addEventListener("click", this, false);
        button.disabled = false;
      }
    },
    initI18n(node, msgKey, shouldUnhide) {
      node.textContent = browser.i18n.getMessage(msgKey);
      if (node.hidden && shouldUnhide) {
        node.hidden = false;
      }
    },
    initI18ns() {
      document.title = browser.i18n.getMessage("extensionName");

      this.title.textContent = browser.i18n.getMessage("pageTitle");
      this.shortDesc.textContent = browser.i18n.getMessage("pageShortDesc");

      let isPost = !!(this.details && this.details.request_body);
      for (let item of this.longDescItems) {
        this.initI18n(item, `pageLongDesc_${item.dataset.i18n}`, !isPost);
      }
      for (let button of this.buttons) {
        this.initI18n(button, `pageButton_${button.id}`, !isPost);
      }
    },
    send(msg) {
      msg.dir = "content2bg";
      return browser.runtime.sendMessage(msg);
    },
    uninit(evt) {
      for (let button of this.buttons) {
        button.disabled = true;
      }
    }
  };

  for (let evtName of ["DOMContentLoaded", "unload"]) {
    window.addEventListener(evtName, needIE, false);
  }
})();
