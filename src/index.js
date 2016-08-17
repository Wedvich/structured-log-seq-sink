require('es6-promise').polyfill();
require('isomorphic-fetch');

let url;
let apiKey;

class SeqSink {
  constructor(options) {
    if (!options)
      throw new Error(`'options' parameter is required.`);
    if (!options.url)
      throw new Error(`'options.url' parameter is required.`);

    url = options.url;
    apiKey = options.apiKey;
  }

  toString() {
    return 'SeqSink';
  }

  emit(events, done) {

    console.log(this);

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

    const apiKeyParameter = apiKey ? `?apiKey=${apiKey}` : '';

    fetch(`${url}/api/events/raw${apiKeyParameter}`, {
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      body
    })
      .then(response => done(response));
  }
}

export default function SeqSinkFactory(options) {
  return new SeqSink(options);
}
