import _ from 'lodash'
import { promises as fsPromises } from 'fs'
import dayjs from 'dayjs'
import path from 'path'

export const getenv = (key, defaultval) => _.get(process, ['env', key], defaultval)

export const getBaseurl = (() => {
  const baseurl = _.trimEnd(getenv('BASEURL', 'https://taichunmin.idv.tw/pn532.js/'), '/') + '/'
  return () => baseurl
})()

export const errToPlainObj = (() => {
  const ERROR_KEYS = [
    'address',
    'code',
    'data',
    'dest',
    'errno',
    'info',
    'message',
    'name',
    'path',
    'port',
    'reason',
    'response.data',
    'response.headers',
    'response.status',
    'stack',
    'status',
    'statusCode',
    'statusMessage',
    'syscall',
  ]
  return err => _.pick(err, ERROR_KEYS)
})()

export const genSitemap = (() => {
  const toUrl = url => `<url><loc>${url}</loc><changefreq>daily</changefreq></url>`
  const toUrlset = urls => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${_.join(_.map(urls, toUrl), '')}</urlset>`
  const toSitemap = ({ lastmod, url }) => `<sitemap><loc>${url}</loc><lastmod>${lastmod}</lastmod></sitemap>`
  const toSitemapIndex = ({ lastmod, urls }) => `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${_.join(_.map(urls, url => toSitemap({ lastmod, url })), '')}</sitemapindex>`
  return async ({ baseurl, dist, urls }) => {
    const sitemapIndex = []
    const lastmod = dayjs().format('YYYY-MM-DDTHH:mmZ')
    for (const [index, chunk] of _.toPairs(_.chunk(urls, 1000))) {
      await fsPromises.writeFile(path.join(dist, `sitemap_${index}.xml`), toUrlset(chunk))
      sitemapIndex.push(new URL(`sitemap_${index}.xml`, baseurl).href)
    }
    await fsPromises.writeFile(path.join(dist, 'sitemap.xml'), toSitemapIndex({ lastmod, urls: sitemapIndex }))
  }
})()
