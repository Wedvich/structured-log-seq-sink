# structured-log-seq-sink [![Build Status](https://travis-ci.org/Wedvich/structured-log-seq-sink.svg?branch=master)](https://travis-ci.org/Wedvich/structured-log-seq-sink)

A [structured-log](https://github.com/structured-log/structured-log) plugin that writes log events to [Seq](https://getseq.net/).

Uses [es6-promise](https://github.com/stefanpenner/es6-promise) and [isomorphic-fetch](https://github.com/matthew-andrews/isomorphic-fetch) to polyfill Promises and fetch, respectively.

### Installation

```
npm i structured-log-seq-sink --save
```

### Usage

```js
var structuredLog = require('structured-log');
var seqSink = require('structured-log-seq-sink');

var logger = structuredLog.configure()
  .writeTo(seqSink({ /* ... options ...  */ }))
  .create();

```

##### Available options

|Parameter|Description|
|---|---|
|`apiKey`|(optional) API key to use|
|`url`|(required) URL to the Seq server|

### Building and testing

To build the modules yourself, ensure [Rollup](http://rollupjs.org/) is installed globally, and run the `build` script:

```
npm i rollup -g
npm run build
```

Then, you can test the bundled module by running:

```
npm test
```
