class SeqSink {

  url = null;
  apiKey = null;
  durable = false;
  compact = false;

  constructor(options) {
    if (!options)
      throw new Error(`'options' parameter is required.`);
    if (!options.url)
      throw new Error(`'options.url' parameter is required.`);

    this.url = options.url.replace(/\/$/, '');
    this.apiKey = options.apiKey;

    if (options.durable && typeof(localStorage) === 'undefined') {
      if (typeof(console) !== 'undefined' && console.warn) {
        console.warn(`'options.durable' parameter was set to true, but 'localStorage' is not available.`);
      }
      this.durable = false;
    } else {
      this.durable = !!options.durable;
    }

    this.compact = !!options.compact;

    if (this.durable) {
      const requests = {};
      for (let i = 0; i < localStorage.length; ++i) {
        const storageKey = localStorage.key(i);
        if (storageKey.indexOf('structured-log-seq-sink') !== 0)
          continue;

        const body = localStorage.getItem(storageKey);
        requests[storageKey] = postToSeq(() => {}, this.url, this.apiKey, body);
      }
      for (const k in requests) {
        if (requests.hasOwnProperty(k))
          requests[k].then(() => localStorage.removeItem(k));
      }
    }
  }

  toString() {
    return 'SeqSink';
  }

  emit = (events, done) => {
    const seqEvents = this.compact ? events.reduce((s, e) => {
      return JSON.stringify({
        '@l': mapLogLevel(e.level),
        '@mt': e.messageTemplate.raw,
        '@t': e.timestamp,
        ...e.properties
      }) + '\n';
    }, ''): events.map(e => {
      return {
        'Level': e.level,
        'MessageTemplate': e.messageTemplate.raw,
        'Properties': e.properties,
        'Timestamp': e.timestamp
      };
    });

    const body = this.compact ? seqEvents : JSON.stringify({
      'Events': seqEvents
    });

    let storageKey;
    if (this.durable) {
      storageKey = `structured-log-seq-sink-${new Date().getTime()}-${Math.floor(Math.random() * 1000000) + 1}`;
      localStorage.setItem(storageKey, body);
    }

    const promise = postToSeq(this.url, this.apiKey, this.compact, body, storageKey, done);
    return storageKey
      ? promise.then(() => localStorage.removeItem(storageKey))
      : promise;
  }
}

function postToSeq(url, apiKey, compact, body, storageKey, done) {
  const apiKeyParameter = apiKey ? `?apiKey=${apiKey}` : '';
  const promise = fetch(`${url}/api/events/raw${apiKeyParameter}`, {
    headers: {
      'content-type': compact ? 'application/vnd.serilog.clef' : 'application/json'
    },
    method: 'POST',
    body
  });

  return !done ? promise : promise.then(response => done(response));
}

function mapLogLevel(logLevel) {

  // If the log level isn't numeric (structured-log < 0.1.0), return it as-is.
  if (isNaN(logLevel)) {
    return logLevel;
  }
  
  // Parse numeric log level (structured-log >= 0.1.0).
  switch (logLevel) {
    case 0: return 'Fatal';
    case 1: return 'Error';
    case 2: return 'Warning';
    case 3: return 'Information';
    case 4: return 'Debug';
    case 5: return 'Verbose';
  }

  // Default to Information.
  return 'Information';
}

export default function SeqSinkFactory(options) {
  return new SeqSink(options);
}
