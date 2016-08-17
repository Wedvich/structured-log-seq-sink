(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.SeqSink = factory());
}(this, (function () { 'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

require('es6-promise').polyfill();
require('isomorphic-fetch');

var url = void 0;
var apiKey = void 0;

var SeqSink = function () {
  function SeqSink(options) {
    _classCallCheck(this, SeqSink);

    if (!options) throw new Error('\'options\' parameter is required.');
    if (!options.url) throw new Error('\'options.url\' parameter is required.');

    url = options.url;
    apiKey = options.apiKey;
  }

  _createClass(SeqSink, [{
    key: 'toString',
    value: function toString() {
      return 'SeqSink';
    }
  }, {
    key: 'emit',
    value: function emit(events, done) {

      console.log(this);

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

      var apiKeyParameter = apiKey ? '?apiKey=' + apiKey : '';

      fetch(url + '/api/events/raw' + apiKeyParameter, {
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        body: body
      }).then(function (response) {
        return done(response);
      });
    }
  }]);

  return SeqSink;
}();

function SeqSinkFactory(options) {
  return new SeqSink(options);
}

return SeqSinkFactory;

})));