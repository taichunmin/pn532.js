/**
 * @module pn532.js/utils
 * @example
 * import * as Pn532Utils from 'pn532.js/utils'
 */
import _ from 'lodash'

export const logTime = (...args) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...args)

export const sleep = t => new Promise(resolve => setTimeout(resolve, t))

export class RethrownError extends Error {
  constructor (err) {
    if (!(err instanceof Error)) throw new TypeError('invalid err type')
    super(err.message)
    this.name = this.constructor.name
    this.originalError = err
    this.stack = `${this.stack}\n${err.stack}`
  }
}

export const retry = async (fn, times = 3) => {
  if (times < 1) throw new TypeError('invalid times')
  let lastErr = null
  while (times--) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  throw new RethrownError(lastErr)
}

export const middlewareCompose = middleware => {
  // 型態檢查
  if (!_.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
  if (_.some(middleware, fn => !_.isFunction(fn))) throw new TypeError('Middleware must be composed of functions!')

  return async (context = {}, next) => {
    const cloned = [...middleware, ...(_.isFunction(next) ? [next] : [])]
    if (!cloned.length) return
    const executed = _.times(cloned.length + 1, () => 0)
    const dispatch = async cur => {
      if (executed[cur] !== 0) throw new Error(`middleware[${cur}] called multiple times`)
      if (cur >= cloned.length) {
        executed[cur] = 2
        return
      }
      try {
        executed[cur] = 1
        const result = await cloned[cur](context, () => dispatch(cur + 1))
        if (executed[cur + 1] === 1) throw new Error(`next() in middleware[${cur}] should be awaited`)
        executed[cur] = 2
        return result
      } catch (err) {
        executed[cur] = 3
        if (err.stack) err.stack = err.stack.replace(/at async dispatch[^\n]+\n[^\n]+\n\s*/g, '')
        throw err
      }
    }
    return await dispatch(0)
  }
}
