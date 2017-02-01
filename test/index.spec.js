var seqSink = require('../dist/structured-log-seq-sink');

var fetchMock = require('fetch-mock');
fetchMock.mock('http://mock/api/events/raw', { 
  MinimumLevelAccepted: "Information"
});

var sinon = require('sinon');
var chai = require('chai');
var assert = chai.assert;

const LEVEL_VERBOSE = 63;
const LEVEL_DEBUG = 31;
const LEVEL_INFORMATION = 15;
const LEVEL_WARNING = 7;
const LEVEL_ERROR = 3;

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

  it('should only POST events matching the log level', function() {
    var testSwitch = { 
      isEnabled: sinon.stub(),
      information: sinon.stub()
    };
    var sink = seqSink({ 
      url: 'http://mock',
      levelSwitch: testSwitch
    });

    var events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Warning-Level message' },
      level: LEVEL_WARNING,
      properties: { }
    }, {
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Error-Level message' },
      level: LEVEL_ERROR,
      properties: { }
    }];

    testSwitch.isEnabled
      .returns(false)
      .withArgs(LEVEL_ERROR).returns(true);

    return sink.emit(events)
      .then(function () {
        var requestBody = JSON.parse(fetchMock.lastCall()[1].body);
        assert.property(requestBody, 'Events');
        assert.equal(requestBody.Events.length, 1);

        var logEvent = requestBody.Events[0];
        assert.propertyVal(logEvent, 'Level', 'Error');
      });
  });

  it("should update the log level", function() {
    var testSwitch = { 
      isEnabled: sinon.stub(),
      information: sinon.stub()
    };
    var sink = seqSink({ 
      url: 'http://mock',
      levelSwitch: testSwitch
    });

    var events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Warning-Level message' },
      level: LEVEL_WARNING,
      properties: { }
    }];

    testSwitch.isEnabled
      .returns(true);
    
    return sink.emit(events)
      .then(function () {
        assert.equal(testSwitch.information.callCount, 1);
      });
  })

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
    return sink.emit(events)
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
      level: LEVEL_WARNING,
      properties: { sample: { count: 5 } },
      error: new Error('Oops')
    }, {
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Event example with a template parameter: {counter}' },
      level: LEVEL_DEBUG,
      properties: { counter: 21 }
    }];

    var emitPromise = Promise.resolve();
    return sink.emit(events)
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
