(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.SeqSink = factory());
}(this, (function () { 'use strict';

  var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

  function postToSeq(url, apiKey, compact, body, done) {
    var apiKeyParameter = apiKey ? '?apiKey=' + apiKey : '';
    var promise = fetch(url + '/api/events/raw' + apiKeyParameter, {
      headers: {
        'content-type': compact ? 'application/vnd.serilog.clef' : 'application/json'
      },
      method: 'POST',
      body: body
    });

    return !done ? promise : promise.then(function (response) {
      return done(response);
    });
  }

  function mapLogLevel(logLevel) {
    // If the log level isn't numeric (structured-log < 0.1.0), return it as-is.
    if (isNaN(logLevel)) {
      return logLevel;
    }

    // Parse bitfield log level (structured-log >= 0.1.0-alpha).
    if (logLevel === 1) {
      return 'Fatal';
    } else if (logLevel === 3) {
      return 'Error';
    } else if (logLevel === 7) {
      return 'Warning';
    } else if (logLevel === 31) {
      return 'Debug';
    } else if (logLevel === 63) {
      return 'Verbose';
    }

    // Default to Information.
    return 'Information';
  }

  function logSuppressedError(reason) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Suppressed error when logging to Seq: ' + reason);
    }
  }

  var SeqSink = function () {
    function SeqSink(options) {
      var _this = this;

      _classCallCheck(this, SeqSink);

      this.url = null;
      this.apiKey = null;
      this.durable = false;
      this.compact = false;
      this.levelSwitch = null;
      this.refreshLevelSwitchTimeoutId = null;
      this.refreshLevelSwitchTimeoutInterval = 2 * 60 * 1000;
      this.suppressErrors = true;

      if (!options) {
        throw new Error('\'options\' parameter is required.');
      }
      if (!options.url) {
        throw new Error('\'options.url\' parameter is required.');
      }

      this.url = options.url.replace(/\/$/, '');
      this.apiKey = options.apiKey;
      this.levelSwitch = options.levelSwitch || null;
      this.suppressErrors = options.suppressErrors !== false;

      if (options.durable && typeof localStorage === 'undefined') {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('\'options.durable\' parameter was set to true, but \'localStorage\' is not available.');
        }
        this.durable = false;
      } else {
        this.durable = !!options.durable;
      }

      this.compact = !!options.compact;

      if (this.durable) {
        var requests = {};
        for (var i = 0; i < localStorage.length; ++i) {
          var storageKey = localStorage.key(i);
          if (storageKey.indexOf('structured-log-seq-sink') !== 0) {
            continue;
          }

          var body = localStorage.getItem(storageKey);
          requests[storageKey] = postToSeq(this.url, this.apiKey, this.compact, body).then(function () {
            return localStorage.removeItem(k);
          }).catch(function (reason) {
            return _this.suppressErrors ? logSuppressedError(reason) : Promise.reject(reason);
          });
        }
      }

      if (this.levelSwitch !== null) {
        this.refreshLevelSwitchTimeoutId = setTimeout(function () {
          return _this.sendToServer([]);
        }, this.refreshLevelSwitchTimeoutInterval);
      }
    }

    _createClass(SeqSink, [{
      key: 'toString',
      value: function toString() {
        return 'SeqSink';
      }
    }, {
      key: 'emit',
      value: function emit(events, done) {
        var _this2 = this;

        var filteredEvents = this.levelSwitch ? events.filter(function (e) {
          return _this2.levelSwitch.isEnabled(e.level);
        }) : events;

        if (!filteredEvents.length) {
          return done ? Promise.resolve().then(function () {
            return done(null);
          }) : Promise.resolve();
        }

        return this.sendToServer(filteredEvents, done);
      }
    }, {
      key: 'sendToServer',
      value: function sendToServer(events, done) {
        var _this3 = this;

        var seqEvents = this.compact ? events.reduce(function (s, e) {
          var mappedEvent = _extends({
            '@l': mapLogLevel(e.level),
            '@mt': e.messageTemplate.raw,
            '@t': e.timestamp
          }, e.properties);
          if (e.error instanceof Error && e.error.stack) {
            mappedEvent['@x'] = e.error.stack;
          }
          return '' + s + JSON.stringify(mappedEvent) + '\n';
        }, '').replace(/\s+$/g, '') : events.map(function (e) {
          var mappedEvent = {
            Level: mapLogLevel(e.level),
            MessageTemplate: e.messageTemplate.raw,
            Properties: e.properties,
            Timestamp: e.timestamp
          };
          if (e.error instanceof Error && e.error.stack) {
            mappedEvent.Exception = e.error.stack;
          }
          return mappedEvent;
        });

        var body = this.compact ? seqEvents : JSON.stringify({
          Events: seqEvents
        });

        var storageKey = void 0;
        if (this.durable) {
          storageKey = 'structured-log-seq-sink-' + new Date().getTime() + '-' + (Math.floor(Math.random() * 1000000) + 1);
          localStorage.setItem(storageKey, body);
        }

        return postToSeq(this.url, this.apiKey, this.compact, body, done).then(function (response) {
          return response.json();
        }).then(function (json) {
          return _this3.updateLogLevel(json);
        }).then(function () {
          if (storageKey) localStorage.removeItem(storageKey);
        }).catch(function (reason) {
          return _this3.suppressErrors ? logSuppressedError(reason) : Promise.reject(reason);
        });
      }
    }, {
      key: 'updateLogLevel',
      value: function updateLogLevel(response) {
        var _this4 = this;

        if (!this.levelSwitch) return;

        if (this.refreshLevelSwitchTimeoutId) {
          clearTimeout(this.refreshLevelSwitchTimeoutId);
          this.refreshLevelSwitchTimeoutId = setTimeout(function () {
            return _this4.sendToServer([]);
          }, this.refreshLevelSwitchTimeoutInterval);
        }

        if (response && response.MinimumLevelAccepted) {
          switch (response.MinimumLevelAccepted) {
            case 'Fatal':
              this.levelSwitch.fatal();
              break;
            case 'Error':
              this.levelSwitch.error();
              break;
            case 'Warning':
              this.levelSwitch.warning();
              break;
            case 'Information':
              this.levelSwitch.information();
              break;
            case 'Debug':
              this.levelSwitch.debug();
              break;
            case 'Verbose':
              this.levelSwitch.verbose();
              break;
          }
        }
      }
    }, {
      key: 'flush',
      value: function flush() {
        return Promise.resolve();
      }
    }]);

    return SeqSink;
  }();

  function SeqSinkFactory(options) {
    return new SeqSink(options);
  }

  return SeqSinkFactory;

})));
