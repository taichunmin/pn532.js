import 'dotenv/config' // run dotenv first

import { build } from './build.js'
import { fileURLToPath } from 'url'
import { getBaseurl } from './utils.js'
import { promises as fsPromises } from 'fs'
import createLogger from 'debug'
import finalhandler from 'finalhandler'
import https from 'https'
import livereload from 'livereload'
import path from 'path'
import serveStatic from 'serve-static'
import watch from 'node-watch'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const log = createLogger('app:watch')

async function readMkcert () {
  try {
    const [cert, key] = await Promise.all([
      fsPromises.readFile(path.resolve(__dirname, 'mkcert/cert.pem')),
      fsPromises.readFile(path.resolve(__dirname, 'mkcert/key.pem')),
    ])
    return { cert, key }
  } catch (err) {
    throw new Error('Failed to load mkcert. Please run "yarn mkcert" first.')
  }
}

async function main () {
  const publicDir = path.resolve(__dirname, 'dist')
  const baseUrl = getBaseurl()
  await build(true)
  log(`build finish. Visit: ${baseUrl}`)

  const livereloadServer = livereload.createServer({
    delay: 1000,
    port: 30000,
    server: https.createServer(await readMkcert(), async (req, res) => {
      serveStatic(publicDir, {
        index: ['index.html', 'index.htm'],
      })(req, res, finalhandler(req, res))
    }),
  })

  watch(['./layout', './src', './web'], { recursive: true }, async (e, name) => {
    if (e !== 'update') return
    const match = name.match(/^web[\\/](.+)\.pug$/)
    await build()
    if (!match) log(`"${name}" changed.`)
    else log(`${baseUrl}${match[1].replace(/\\/g, '/')}.html`)
    livereloadServer.refresh('')
  })
}

main()
