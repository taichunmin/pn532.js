import _ from 'lodash'
import { terser } from 'rollup-plugin-terser'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

// good rollup example: https://github.com/MattiasBuelens/web-streams-polyfill/blob/master/rollup.config.js
const configBrowser = {
  format: 'umd',
  globals: {
    lodash: '_',
  },
}

const configs = _.map([
  { name: 'Pn532', input: 'main', output: 'pn532' },
  { name: 'Pn532WebbleAdapter', input: 'plugin/WebbleAdapter', output: 'plugin/WebbleAdapter' },
  { name: 'Pn532WebserialAdapter', input: 'plugin/WebserialAdapter', output: 'plugin/WebserialAdapter' },
  { name: 'Pn532LoggerRxTx', input: 'plugin/LoggerRxTx', output: 'plugin/LoggerRxTx' },
  { name: 'Pn532Hf14a', input: 'plugin/Hf14a', output: 'plugin/Hf14a' },
], arg => ({
  input: `src/${arg.input}.js`,
  plugins: [json(), resolve(), commonjs()],
  external: [
    'lodash',
  ],
  output: [
    {
      ...configBrowser,
      name: arg.name,
      file: `dist/${arg.output}.js`,
    },
    {
      ...configBrowser,
      name: arg.name,
      file: `dist/${arg.output}.min.js`,
      plugins: [terser()],
    },
  ],
}))

export default configs
