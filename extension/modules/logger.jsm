/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let EXPORTED_SYMBOLS = ['Logger'];
const Cu = Components.utils;

Cu.import('resource://gre/modules/Services.jsm');

let {Log} = Cu.import('resource://gre/modules/Log.jsm');

let Logger = {
  getLogger: function(aTarget) {
    ['LOG', 'WARN', 'ERROR'].forEach(function(aName) {
      aTarget.__defineGetter__(aName, function() {
        if (this._logger === undefined) {
          /**
           * Log.jsm has been supported since Fx26
           * We try to keep interfaces exactly the same here
           */
          this._logger = Log.repository.getLogger('COBA');
          let loggingEnabled = Services.prefs.getBoolPref('extensions.logging.enabled', false);
          this._logger.level = Log.Level[loggingEnabled ? 'Debug' : 'Warn'];
          this._logger.addAppender(new Log.ConsoleAppender(new Log.BasicFormatter()));
          this._logMapper = function(s) {
            return {
              LOG: 'debug',
              WARN: 'warn',
              ERROR: 'error'
            }[s];
          };
        }
        return function(message) {
          this._logger[this._logMapper(aName)](message);
        };
      });
    }, aTarget);
  }
};
