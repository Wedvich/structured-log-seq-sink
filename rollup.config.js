import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/index.js',
  targets: [
    { dest: 'dist/structured-log-seq-sink.js', format: 'umd', moduleName: 'SeqSink' },
    { dest: 'dist/structured-log-seq-sink.es6.js', format: 'es' }
  ],
  plugins: [babel({
    exclude: 'node_modules/**'
  })]
}
