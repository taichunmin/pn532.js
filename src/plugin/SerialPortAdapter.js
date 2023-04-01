import _ from 'lodash'
import { Duplex } from 'stream'
import { SerialPort } from 'serialport'

/**
 * @module pn532.js/plugin/SerialPortAdapter
 * @example
 * import Pn532SerialPortAdapter from 'pn532.js/plugin/SerialPortAdapter'
 *
 * // Run serialport-list to list port, see https://serialport.io/docs/bin-list
 * pn532.use(new Pn532SerialPortAdapter(), { path: '/dev/tty.usbserial-120' })
 */
export default class Pn532SerialPortAdapter {
  name = 'adapter'
  port = null

  install (context, pluginOption = {}) {
    const { pn532, utils } = context

    if (pn532.$adapter) throw new Error('adapter already exists')

    const me = this
    pluginOption = {
      baudRate: 115200,
      ...pluginOption,
    }

    /**
     * Determines whether SerialPort is supported.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {Promise<boolean>} Resolve with a boolean indicating whether or not SerialPort is supported.
     */
    async function isSupported () {
      return !_.isNil(SerialPort)
    }

    /**
     * Determines whether the connection of adapter is open.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {boolean} A boolean indicating whether or not the connection of adapter is open.
     */
    function isOpen () {
      return Boolean(me?.port?.isOpen)
    }

    /**
     * Disconnect the connection of adapter.
     * @memberof Pn532WebserialAdapter
     * @instance
     * @async
     * @returns {Promise<null>} Resolve after finished.
     */
    async function disconnect () {
      if (_.isNil(me.port)) return
      await new Promise((resolve, reject) => { me.port.close(err => err ? reject(err) : resolve()) })
    }

    async function disconnected () {
      if (me.port) me.port = null
      utils.logTime('device disconnected')
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
        if (!await isSupported()) throw new Error('SerialPort not supported')

        // open port
        me.port = await new Promise((resolve, reject) => {
          const port = new SerialPort(pluginOption, err => err ? reject(err) : resolve(port))
        })
        utils.logTime(`port connected, path = ${pluginOption.path}, baudRate = ${pluginOption.baudRate}`)
        const portWeb = Duplex.toWeb(me.port)
        pn532.tx = portWeb
        me.port.once('close', disconnected)
        portWeb.readable.pipeTo(pn532.rx.writable)

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
