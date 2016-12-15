(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.SeqSink = factory());
}(this, (function () { 'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SeqSink = function () {
  function SeqSink(options) {
    var _this = this;

    _classCallCheck(this, SeqSink);

    this.url = null;
    this.apiKey = null;
    this.durable = false;

    this.emit = function (events, done) {
      var seqEvents = events.map(function (e) {
        return {
          'Level': e.level,
          'MessageTemplate': e.messageTemplate.raw,
          'Properties': e.properties,
          'Timestamp': e.timestamp
        };
      });

      var body = JSON.stringify({
        'Events': seqEvents
      });

      var storageKey = void 0;
      if (_this.durable) {
        storageKey = 'structured-log-seq-sink-' + new Date().getTime() + '-' + (Math.floor(Math.random() * 1000000) + 1);
        localStorage.setItem(storageKey, body);
      }

      var promise = postToSeq(done, _this.url, _this.apiKey, body, storageKey);
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

    if (this.durable) {
      var requests = {};
      for (var i = 0; i < localStorage.length; ++i) {
        var storageKey = localStorage.key(i);
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

function postToSeq(done, url, apiKey, body, storageKey) {
  var apiKeyParameter = apiKey ? '?apiKey=' + apiKey : '';
  return fetch(url + '/api/events/raw' + apiKeyParameter, {
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    body: body
  }).then(function (response) {
    return done(response);
  });
}

function SeqSinkFactory(options) {
  return new SeqSink(options);
}

return SeqSinkFactory;

})));