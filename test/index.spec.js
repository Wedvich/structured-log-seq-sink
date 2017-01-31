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
  beforeEach(fetchMock.reset);

  it('should POST a well-formatted Seq event', function () {
    var sink = seqSink({ url: 'http://mock' });

    var events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Event example with a template parameter: {@sample}' },
      level: 'Warning',
      properties: { sample: { count: 5 } },
      error: new Error('Oops')
    }];

    var emitPromise = Promise.resolve();
    return emitPromise
      .then(sink.emit(events, emitPromise.resolve))
      .then(function () {
        var requestBody = JSON.parse(fetchMock.lastCall()[1].body);
        assert.property(requestBody, 'Events');
        var logEvent = requestBody.Events[0];
        assert.propertyVal(logEvent, 'Level', 'Warning');
        assert.propertyVal(logEvent, 'MessageTemplate', 'Event example with a template parameter: {@sample}');
        assert.deepPropertyVal(logEvent, 'Properties.sample.count', 5);
        assert.property(logEvent, 'Timestamp');
        assert.property(logEvent, 'Exception');
      });
  });

  it('should POST a well-formatted compact Seq event', function () {
    var sink = seqSink({ url: 'http://mock', compact: true });

    var events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Event example with a template parameter: {@sample}' },
      level: 'Warning',
      properties: { sample: { count: 5 } },
      error: new Error('Oops')
    }, {
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Event example with a template parameter: {counter}' },
      level: 'Debug',
      properties: { counter: 21 }
    }];

    var emitPromise = Promise.resolve();
    return emitPromise
      .then(sink.emit(events, emitPromise.resolve))
      .then(function () {
        var logEvents = fetchMock.lastCall()[1].body.split('\n').map(JSON.parse);

        var logEvent1 = logEvents[0];
        assert.propertyVal(logEvent1, '@l', 'Warning');
        assert.propertyVal(logEvent1, '@mt', 'Event example with a template parameter: {@sample}');
        assert.deepPropertyVal(logEvent1, 'sample.count', 5);
        assert.property(logEvent1, '@t');
        assert.property(logEvent1, '@x');

        var logEvent2 = logEvents[1];
        assert.propertyVal(logEvent2, '@l', 'Debug');
        assert.propertyVal(logEvent2, '@mt', 'Event example with a template parameter: {counter}');
        assert.propertyVal(logEvent2, 'counter', 21);
        assert.property(logEvent2, '@t');
      });
  });
});
