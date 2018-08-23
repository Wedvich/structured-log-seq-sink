const seqSink = require('../dist/structured-log-seq-sink');

const fetchMock = require('fetch-mock');
fetchMock.reset();

fetchMock.mock(
  'https://mock/api/events/raw',
  { MinimumLevelAccepted: "Information" },
  { overwriteRoutes: true }
);

fetchMock.mock(
  'https://invalid/api/events/raw',
  () => Promise.reject('Something went wrong'),
  { overwriteRoutes: true }
);

const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const assert = chai.assert;

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
    const sink = seqSink({ url: 'https://test/' });
    assert.equal(sink.url, 'https://test');
  });

  it('should have instance parameters', function () {
    const sink1 = seqSink({ url: 'https://test', apiKey: 'abc' });
    const sink2 = seqSink({ url: 'https://test', apiKey: 'def' });
    assert.equal('abc', sink1.apiKey);
    assert.equal('def', sink2.apiKey);
  });
});

describe('toString', function () {
  it('should return SeqSink', function () {
    const sink = seqSink({ url: 'https://mock' });
    assert.equal(sink.toString(), 'SeqSink');
  });
});

describe('emit', function () {
  beforeEach(fetchMock.reset);

  it('should only POST events matching the log level', function() {
    const testSwitch = { 
      isEnabled: sinon.stub(),
      information: sinon.stub()
    };
    const sink = seqSink({ 
      url: 'https://mock',
      levelSwitch: testSwitch
    });

    const events = [{
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
        const requestBody = JSON.parse(fetchMock.lastCall()[1].body);
        assert.property(requestBody, 'Events');
        assert.equal(requestBody.Events.length, 1);

        const logEvent = requestBody.Events[0];
        assert.propertyVal(logEvent, 'Level', 'Error');
      });
  });

  it('should update the log level', function() {
    const testSwitch = { 
      isEnabled: sinon.stub(),
      information: sinon.stub()
    };
    const sink = seqSink({ 
      url: 'https://mock',
      levelSwitch: testSwitch
    });

    const events = [{
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
    const sink = seqSink({ url: 'https://mock' });

    const events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Event example with a template parameter: {@sample}' },
      level: 'Warning',
      properties: { sample: { count: 5 } },
      error: new Error('Oops')
    }];

    return sink.emit(events)
      .then(function () {
        const requestBody = JSON.parse(fetchMock.lastCall()[1].body);
        assert.property(requestBody, 'Events');
        const logEvent = requestBody.Events[0];
        assert.propertyVal(logEvent, 'Level', 'Warning');
        assert.propertyVal(logEvent, 'MessageTemplate', 'Event example with a template parameter: {@sample}');
        assert.deepNestedPropertyVal(logEvent, 'Properties.sample.count', 5);
        assert.property(logEvent, 'Timestamp');
        assert.property(logEvent, 'Exception');
      });
  });

  it('should POST a well-formatted compact Seq event', function () {
    const sink = seqSink({ url: 'https://mock', compact: true });

    const events = [{
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

    return sink.emit(events)
      .then(function () {
        const logEvents = fetchMock.lastCall()[1].body.split('\n').map(JSON.parse);

        const logEvent1 = logEvents[0];
        assert.propertyVal(logEvent1, '@l', 'Warning');
        assert.propertyVal(logEvent1, '@mt', 'Event example with a template parameter: {@sample}');
        assert.deepNestedPropertyVal(logEvent1, 'sample.count', 5);
        assert.property(logEvent1, '@t');
        assert.property(logEvent1, '@x');

        const logEvent2 = logEvents[1];
        assert.propertyVal(logEvent2, '@l', 'Debug');
        assert.propertyVal(logEvent2, '@mt', 'Event example with a template parameter: {counter}');
        assert.propertyVal(logEvent2, 'counter', 21);
        assert.property(logEvent2, '@t');
      });
  });

  it('should catch errors when `suppressErrors` is true', function () {
    const sink = seqSink({ 
      url: 'https://invalid',
      suppressErrors: true
    });
    const events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Something went wrong' },
      level: LEVEL_ERROR,
      properties: { }
    }];
    return assert.isFulfilled(sink.emit(events));
  });

  it('should propagate errors when `suppressErrors` is false', function () {
    const sink = seqSink({ 
      url: 'https://invalid',
      suppressErrors: false
    });
    const events = [{
      timestamp: new Date().toISOString(),
      messageTemplate: { raw: 'Something went wrong' },
      level: LEVEL_ERROR,
      properties: { }
    }];
    return assert.isRejected(sink.emit(events));
  });
});
