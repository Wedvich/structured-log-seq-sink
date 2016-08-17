# structured-log-seq-sink

A structured-log plugin that writes log events to Seq.

### Usage

```
var seqSink = require('structured-log-seq-sink');

var logger = structuredLog.configure()
  .writeTo(seqSink({ /* options */ }))
  .create();

```

##### Available options

- `apiKey` API key to use
- `url` (required) The URL to the Seq server

### Building

To build the modules, ensure [Rollup](http://rollupjs.org/) is installed globally, and run the `build` script:

```
npm i rollup -g
npm run build
```
