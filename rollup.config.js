import _ from 'lodash'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')
const externalDependencies = _.keys(_.omit(pkg.dependencies, ['web-serial-polyfill']))

// good rollup example: https://github.com/MattiasBuelens/web-streams-polyfill/blob/master/rollup.config.js
const configs = [
  // src/main.js
  {
    input: 'src/main.js',
    plugins: [json(), resolve({ browser: true }), commonjs()],
    external: externalDependencies,
    output: _.times(2, isMin => ({
      file: 'dist/pn532.js',
      format: 'umd',
      name: 'Pn532',
      globals: {
        lodash: '_',
      },
      ...(!isMin ? {} : { // for minify
        file: 'dist/pn532.min.js',
        plugins: [terser()],
      }),
    })),
  },

  // src/Crypto1.js
  {
    input: 'src/Crypto1.js',
    plugins: [json(), resolve({ browser: true }), commonjs()],
    external: [
      ...externalDependencies,
      fileURLToPath(new URL('src/Packet.js', import.meta.url)),
    ],
    output: _.times(2, isMin => ({
      file: 'dist/Crypto1.js',
      format: 'umd',
      name: 'Crypto1',
      globals: {
        lodash: '_',
        [fileURLToPath(new URL('src/Packet.js', import.meta.url))]: 'Pn532.Packet',
      },
      ...(!isMin ? {} : { // for minify
        file: 'dist/Crypto1.min.js',
        plugins: [terser()],
      }),
    })),
  },

  // src/Crypto1.js
  {
    input: 'src/Packet.js',
    plugins: [json(), resolve({ browser: true }), commonjs()],
    external: externalDependencies,
    output: _.times(2, isMin => ({
      file: 'dist/Packet.js',
      format: 'umd',
      name: 'Packet',
      globals: {
        lodash: '_',
      },
      ...(!isMin ? {} : { // for minify
        file: 'dist/Packet.min.js',
        plugins: [terser()],
      }),
    })),
  },

  // plugins
  ..._.map(['Hf14a', 'LoggerRxTx', 'WebbleAdapter', 'WebserialAdapter'], plugin => ({
    input: `src/plugin/${plugin}.js`,
    plugins: [json(), resolve({ browser: true }), commonjs()],
    external: externalDependencies,
    output: _.times(2, isMin => ({
      file: `dist/plugin/${plugin}.js`,
      format: 'umd',
      name: `Pn532${plugin}`,
      globals: {
        lodash: '_',
      },
      ...(!isMin ? {} : { // for minify
        file: `dist/plugin/${plugin}.min.js`,
        plugins: [terser()],
      }),
    })),
  })),
]

export default configs
