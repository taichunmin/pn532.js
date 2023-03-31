import 'dotenv/config' // run dotenv first

import _ from 'lodash'
import { errToPlainObj, getBaseurl, getenv, genSitemap } from './utils.js'
import { fileURLToPath } from 'url'
import { inspect } from 'util'
import { minify as htmlMinifier } from 'html-minifier'
import { promises as fsPromises } from 'fs'
import { rollup } from 'rollup'
import createLogger from 'debug'
import fg from 'fast-glob'
import path from 'path'
import pug from 'pug'
import rollupConfigs from './rollup.config.js'
import UglifyJS from 'uglify-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const log = createLogger('app:index')

export const build = async () => {
  const PUG_OPTIONS = {
    basedir: path.resolve(__dirname),
    baseurl: getBaseurl(),
    NODE_ENV: getenv('NODE_ENV', 'production'),
  }

  const sitemapUrls = [
    new URL('./docs/', PUG_OPTIONS.baseurl).href,
  ]

  const htmlMinifierOptions = {
    caseSensitive: true,
    collapseBooleanAttributes: true,
    collapseInlineTagWhitespace: true,
    collapseWhitespace: true,
    conservativeCollapse: true,
    decodeEntities: true,
    minifyCSS: true,
    minifyJS: code => UglifyJS.minify(code).code,
    removeCDATASectionsFromCDATA: true,
    removeComments: true,
    removeCommentsFromCDATA: true,
    removeEmptyAttributes: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    sortAttributes: true,
    sortClassName: true,
    useShortDoctype: true,
  }

  // compile pug files
  const pugFiles = _.map(await fg('web/**/*.pug'), file => file.slice(4))

  let pugErrors = 0
  for (const file of pugFiles) {
    try {
      let html = pug.renderFile(path.resolve(__dirname, 'web', file), PUG_OPTIONS)
      if (PUG_OPTIONS.NODE_ENV === 'production') html = htmlMinifier(html, htmlMinifierOptions)
      const dist = path.resolve(__dirname, 'dist', file.replace(/\.pug$/, '.html'))
      await fsPromises.mkdir(path.dirname(dist), { recursive: true })
      await fsPromises.writeFile(dist, html)
      sitemapUrls.push(new URL(file.replace(/\.pug$/, '.html').replace(/index\.html$/, ''), PUG_OPTIONS.baseurl).href)
    } catch (err) {
      _.set(err, 'data.src', `./web/${file}`)
      log(`Failed to render pug, err = ${inspect(errToPlainObj(err), { depth: 100, sorted: true })}`)
      pugErrors++
    }
  }
  if (pugErrors) throw new Error(`Failed to render ${pugErrors} pug files.`)

  // sitemap
  await genSitemap({ baseurl: PUG_OPTIONS.baseurl, dist: path.resolve(__dirname, 'dist'), urls: sitemapUrls })

  // rollup
  for (const rollupConfig of rollupConfigs) {
    try {
      const rollupBundle = await rollup(rollupConfig)
      await Promise.all(rollupConfig.output.map(rollupBundle.write))
    } catch (err) {
      console.error(err)
    }
  }

  // package.json for cjs
  await fsPromises.writeFile(path.resolve(__dirname, 'dist/package.json'), JSON.stringify({ type: 'commonjs' }, null, 2))
}
