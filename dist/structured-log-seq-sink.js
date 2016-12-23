(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.SeqSink = factory());
}(this, (function () { 'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SeqSink = function () {
  function SeqSink(options) {
    var _this = this;

    _classCallCheck(this, SeqSink);

    this.url = null;
    this.apiKey = null;
    this.durable = false;
    this.compact = false;

    this.emit = function (events, done) {
      var seqEvents = _this.compact ? events.reduce(function (s, e) {
        return JSON.stringify(_extends({
          '@l': mapLogLevel(e.level),
          '@mt': e.messageTemplate.raw,
          '@t': e.timestamp
        }, e.properties)) + '\n';
      }, '') : events.map(function (e) {
        return {
          'Level': e.level,
          'MessageTemplate': e.messageTemplate.raw,
          'Properties': e.properties,
          'Timestamp': e.timestamp
        };
      });

      var body = _this.compact ? seqEvents : JSON.stringify({
        'Events': seqEvents
      });

      var storageKey = void 0;
      if (_this.durable) {
        storageKey = 'structured-log-seq-sink-' + new Date().getTime() + '-' + (Math.floor(Math.random() * 1000000) + 1);
        localStorage.setItem(storageKey, body);
      }

      var promise = postToSeq(_this.url, _this.apiKey, _this.compact, body, storageKey, done);
      return storageKey ? promise.then(function () {
        return localStorage.removeItem(storageKey);
      }) : promise;
    };

    if (!options) throw new Error('\'options\' parameter is required.');
    if (!options.url) throw new Error('\'options.url\' parameter is required.');

    this.url = options.url.replace(/\/$/, '');
    this.apiKey = options.apiKey;

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
        if (storageKey.indexOf('structured-log-seq-sink') !== 0) continue;

        var body = localStorage.getItem(storageKey);
        requests[storageKey] = postToSeq(function () {}, this.url, this.apiKey, body);
      }

      var _loop = function _loop(k) {
        if (requests.hasOwnProperty(k)) requests[k].then(function () {
          return localStorage.removeItem(k);
        });
      };

      for (var k in requests) {
        _loop(k);
      }
    }
  }

  _createClass(SeqSink, [{
    key: 'toString',
    value: function toString() {
      return 'SeqSink';
    }
  }]);

  return SeqSink;
}();

function postToSeq(url, apiKey, compact, body, storageKey, done) {
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
  // If the log isn't numeric (structured-log < 0.1.0), just return it
  if (isNaN(logLevel)) {
    return logLevel;
  }

  // Parse numeric log level (structured-log >= 0.1.0)
  switch (logLevel) {
    case 0:
      return 'Fatal';
    case 1:
      return 'Error';
    case 2:
      return 'Warning';
    case 3:
      return 'Information';
    case 4:
      return 'Debug';
    case 5:
      return 'Verbose';
  }

  // Default to Information.
  return 'Information';
}

function SeqSinkFactory(options) {
  return new SeqSink(options);
}

return SeqSinkFactory;

})));
