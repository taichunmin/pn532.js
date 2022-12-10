import _ from 'lodash'
import { serial as serialPolyfill } from 'web-serial-polyfill'

/**
 * @module pn532.js/plugin/WebserialAdapter
 * @example
 * import Pn532WebserialAdapter from 'pn532.js/plugin/WebserialAdapter'
 */
const WEBSERIAL_FILTERS = [
  // http://www.linux-usb.org/usb.ids
  // about://device-log
  { usbVendorId: 0x0557, usbProductId: 0x2008 }, // 0557: ATEN International Co., Ltd, 2008: UC-232A Serial Port [pl2303]
  { usbVendorId: 0x067B, usbProductId: 0x04BB }, // 067B: Prolific Technology, Inc., 04BB: PL2303 Serial (IODATA USB-RSAQ2)
  { usbVendorId: 0x067B, usbProductId: 0x2303 }, // 067B: Prolific Technology, Inc., 2303: PL2303 Serial Port
  { usbVendorId: 0x067B, usbProductId: 0xAAA2 }, // 067B: Prolific Technology, Inc., AAA2: PL2303 Serial Adapter (IODATA USB-RSAQ3)
  { usbVendorId: 0x067B, usbProductId: 0xAAA3 }, // 067B: Prolific Technology, Inc., AAA3: PL2303x Serial Adapter
  { usbVendorId: 0x1A86, usbProductId: 0x5523 }, // 1A86: QinHeng Electronics, 5523: CH341 in serial mode, usb to serial port converter
  { usbVendorId: 0x1A86, usbProductId: 0x7522 }, // 1A86: QinHeng Electronics, 7522: CH340 serial converter
  { usbVendorId: 0x1A86, usbProductId: 0x7523 }, // 1A86: QinHeng Electronics, 7523: CH340 serial converter
]

/**
 * This is a web serial adapter of `Pn532`. A pn532 instance must register exactly one adapter plugin. After register to PN532 instance, this plugin will expose plugin functions under `pn532.$adapter`.
 * @example
 * const pn532ble = new Pn532()
 * pn532ble.use(new Pn532WebserialAdapter())
 * console.log(JSON.stringify(await pn532ble.getFirmwareVersion()))
 * // {"firmware":"1.6","ic":"PN532","iso14443a":true,"iso14443b":true,"iso18092":true}
 */
export default class Pn532WebserialAdapter {
  _isOpen = false
  name = 'adapter'
  port = null
  reader = null

  install (context, pluginOption) {
    const { pn532, utils } = context
    const me = this

    if (pn532.$adapter) throw new Error('adapter already exists')

    // register TransformStream
    pn532.tx = new TransformStream({
      flush: async controller => {
        await disconnect()
        controller.terminate()
      },
      transform: async (pack, controller) => {
        controller.enqueue(pack)
      },
    })
    pn532.tx.readable.pipeTo(new WritableStream({ // no wait
      write: async chunk => {
        if (!me.port) throw new Error('me.port can not be null')
        const writer = me.port.writable.getWriter()
        await writer.write(chunk)
        writer.releaseLock()
      },
    }, new CountQueuingStrategy({ highWaterMark: 1 })))

    function getSerial () {
      return navigator?.serial ?? serialPolyfill
    }

    /**
     * Determines whether Web Serial API is supported.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {Promise<boolean>} Resolve with a boolean indicating whether or not Web Serial API is supported.
     */
    async function isSupported () {
      return !_.isNil(getSerial())
    }

    /**
     * Determines whether the connection of adapter is open.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {boolean} A boolean indicating whether or not the connection of adapter is open.
     */
    function isOpen () {
      return me._isOpen
    }

    async function disconnected () {
      me._isOpen = false
      me.reader = null
      if (me.port) {
        await me.port.close().catch(console.error)
        me.port = null
      }
      utils.logTime('device disconnected')
    }

    /**
     * Disconnect the connection of adapter.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {Promise<null>} Resolve after finished.
     */
    async function disconnect () {
      if (me.reader) await me.reader.cancel()
    }

    async function startReadLoop () {
      // https://github.com/GoogleChromeLabs/serial-terminal/blob/main/src/index.ts
      if (me?.port?.readable) {
        try {
          me.reader = me.port.readable.getReader()

          while (true) {
            const { value, done } = await me.reader.read()
            if (value) {
              const writer = pn532.rx.writable.getWriter()
              await writer.write(value)
              writer.releaseLock()
            }
            if (done) break
          }
        } catch (err) {
          console.error(err)
        } finally {
          if (me.reader) me.reader.releaseLock()
        }
      }

      disconnected()
    }

    /**
     * Open the connection of adapter.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {Promise<null>} Resolve after finished.
     */
    async function connect () {
      try {
        if (!await isSupported()) throw new Error('WebSerial not supported')

        // request port
        const serial = getSerial()
        me.port = await serial.requestPort({ filters: WEBSERIAL_FILTERS })
        if (!me.port) throw new Error('user canceled')
        const info = await me.port.getInfo()
        utils.logTime(`port selected, usbVendorId = ${info.usbVendorId}, usbProductId = ${info.usbProductId}`)

        await me.port.open({ baudRate: 115200 })
        me._isOpen = true
        startReadLoop() // no wait

        await pn532.sendCommandWakeup()
        await pn532.resetSettings()
      } catch (err) {
        disconnected()
        throw err
      }
    }

    pn532.addMiddleware('writePacket', async (ctx, next) => {
      if (!isOpen()) await connect()
      return await next()
    })

    return {
      connect,
      disconnect,
      isOpen,
      isSupported,
    }
  }
}
