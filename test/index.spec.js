var structuredLog = require('structured-log');
var seqSink = require('../dist/structured-log-seq-sink');

var fetchMock = require('fetch-mock');
fetchMock.mock('http://mock/api/events/raw', 200);
fetchMock.post('http://mock-post/api/events/raw', 201);

var sinon = require('sinon');
var chai = require('chai');
var assert = chai.assert;

describe('class constructor', function () {
  it('should throw if required options are missing', function () {
    assert.throws(function () { seqSink(); });
    assert.throws(function () { seqSink({}); });
  });

  it('should strip trailing slash from the provided URL', function () {
    var sink = seqSink({ url: 'http://test/' });
    assert.equal(sink.url, 'http://test');
  });

  it('should have instance parameters', function () {
    var sink1 = seqSink({ url: 'http://test', apiKey: 'abc' });
    var sink2 = seqSink({ url: 'http://test', apiKey: 'def' });
    assert.equal('abc', sink1.apiKey);
    assert.equal('def', sink2.apiKey);
  });
});

describe('toString', function () {
  it('should return SeqSink', function () {
    var sink = seqSink({ url: 'http://mock' });
    assert.equal(sink.toString(), 'SeqSink');
  });
});

describe('emit', function () {
  it('should POST a well-formatted Seq event', function () {
    var called = false;
    var sink = seqSink({ url: 'http://mock' });
    var originalEmit = sink.emit;
    var stubEmit = sinon.stub(sink, 'emit', function (events, done) {
      originalEmit.apply(sink, arguments).then(function () {
        called = true;
      });
    });

    var logger = structuredLog.configure()
      .writeTo(sink)
      .create();

    return new Promise(function (resolve) {

      logger.warn('Event example with a template parameter: {@Sample}', { Count: 5 });

      var t = setTimeout(function cb() {
        if (called) {
          clearTimeout(t);
          var requestBody = JSON.parse(fetchMock.lastCall()[1].body);
          assert.isTrue(requestBody.hasOwnProperty('Events'));
          var logEvent = requestBody.Events[0];
          assert.equal(logEvent.Level, 'WARN');
          assert.equal(logEvent.MessageTemplate, 'Event example with a template parameter: {@Sample}');
          assert.deepEqual(logEvent.Properties, { Sample: { Count: 5 } });
          assert.isTrue(logEvent.hasOwnProperty('Timestamp'));
          resolve();
        }
        setTimeout(cb, 10);
      }, 1);
    });
  });
});
