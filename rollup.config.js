import babel from 'rollup-plugin-babel';

export default {
  input: 'src/index.js',
  output: [
    { file: 'dist/structured-log-seq-sink.js', format: 'umd', name: 'SeqSink' },
    { file: 'dist/structured-log-seq-sink.es6.js', format: 'es' }
  ],
  plugins: [babel({
    exclude: 'node_modules/**'
  })]
}
