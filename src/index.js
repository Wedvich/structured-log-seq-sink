class SeqSink {

  url = null;
  apiKey = null;
  durable = false;

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
    const seqEvents = events.map(e => {
      return {
        'Level': e.level,
        'MessageTemplate': e.messageTemplate.raw,
        'Properties': e.properties,
        'Timestamp': e.timestamp
      };
    });

    const body = JSON.stringify({
      'Events': seqEvents
    });

    let storageKey;
    if (this.durable) {
      storageKey = `structured-log-seq-sink-${new Date().getTime()}-${Math.floor(Math.random() * 1000000) + 1}`;
      localStorage.setItem(storageKey, body);
    }

    const promise = postToSeq(done, this.url, this.apiKey, body, storageKey);
    return storageKey
      ? promise.then(() => localStorage.removeItem(storageKey))
      : promise;
  }
}

function postToSeq(done, url, apiKey, body, storageKey) {
  const apiKeyParameter = apiKey ? `?apiKey=${apiKey}` : '';
  return fetch(`${url}/api/events/raw${apiKeyParameter}`, {
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    body
  })
    .then(response => done(response));
}

export default function SeqSinkFactory(options) {
  return new SeqSink(options);
}
