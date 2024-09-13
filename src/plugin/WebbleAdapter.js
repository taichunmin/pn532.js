/**
 * @module pn532.js/plugin/WebbleAdapter
 * @example
 * import Pn532WebbleAdapter from 'pn532.js/plugin/WebbleAdapter'
 */
import _ from 'lodash'

const BLESERIAL_FILTERS = [
  { name: 'JDY-33-BLE' },
  { name: 'NFC-Pro-Q' },
  { name: 'NFC-PRO' },
  { name: 'PcrReader(BLE)' },
  { name: 'PN532-BLE' },
  { services: [0xFF00] }, // HC
  { services: [0xFFE0] }, // HC, JDY
]

const BLESERIAL_UUID = [
  // https://shop.mtoolstec.com/how-to-test-pn532-working-with-bluetooth-module.html
  { serv: 0xFF00, notify: 0xFF01, write: 0xFF02 }, // HC 1
  { serv: 0xFFE0, notify: 0xFFE1, write: 0xFFE2 }, // HC 2
  { serv: 0xFFE0, notify: 0xFFE1, write: 0xFFE1 }, // JDY
]

/**
 * This is a web bluetooth adapter of `Pn532`. A pn532 instance must register exactly one adapter plugin. After register to PN532 instance, this plugin will expose plugin functions under `pn532.$adapter`.
 * @example
 * const pn532ble = new Pn532()
 * pn532ble.use(new Pn532WebbleAdapter())
 * console.log(JSON.stringify(await pn532ble.getFirmwareVersion()))
 * // {"firmware":"1.6","ic":"PN532","iso14443a":true,"iso14443b":true,"iso18092":true}
 */
export default class Pn532WebbleAdapter {
  _isOpen = false
  charNotify = null
  charWrite = null
  device = null
  name = 'adapter'
  service = null

  install (context, pluginOption) {
    const { Packet, pn532, utils } = context
    const { debug = 0 } = pluginOption
    const me = this

    if (pn532.$adapter) throw new Error('adapter already exists')

    const deviceOptionalServices = _.uniq(_.map(BLESERIAL_UUID, 'serv'))

    // register TransformStream
    pn532.tx = new TransformStream({
      flush: async controller => {
        await disconnect()
        controller.terminate()
      },
      transform: async (pack, controller) => {
        // https://stackoverflow.com/questions/38913743/maximum-packet-length-for-bluetooth-le
        // 20 bytes are left for the attribute data
        for (let i = 0; i < pack.length; i += 20) {
          const buf1 = pack.subarray(i, i + 20)
          const buf2 = new Packet(buf1.length)
          buf2.set(buf1)
          controller.enqueue(buf2)
        }
      },
    })
    pn532.tx.readable.pipeTo(new WritableStream({ // no wait
      write: async chunk => {
        if (!me.charWrite) throw new Error('me.charWrite can not be null')
        await me.charWrite.writeValueWithoutResponse(chunk.buffer)
      },
    }, new CountQueuingStrategy({ highWaterMark: 1 })))

    /**
     * Determines whether Web Bluetooth API is supported.
     * @memberof Pn532WebbleAdapter
     * @instance
     * @async
     * @returns {Promise<boolean>} Resolve with a boolean indicating whether or not Web Bluetooth API is supported.
     */
    async function isSupported () {
      return await _.invoke(navigator, 'bluetooth.getAvailability')
    }

    /**
     * Determines whether the adapter is open.
     * @memberof Pn532WebbleAdapter
     * @instance
     * @async
     * @returns {boolean} A boolean indicating whether or not the adapter is open.
     */
    function isOpen () {
      return me._isOpen
    }

    function gattIsConnected () {
      return _.get(me, 'device.gatt.connected')
    }

    async function gattOnNotify (event) {
      const pack = new Packet(event?.target?.value?.buffer)
      if (debug) utils.logTime(`gattOnNotify = ${pack.inspect}`)
      const writer = pn532.rx.writable.getWriter()
      await writer.write(pack)
      writer.releaseLock()
    }

    /**
     * Disconnect the connection of adapter.
     * @memberof Pn532WebbleAdapter
     * @instance
     * @async
     * @returns {Promise<null>} Resolve after finished.
     */
    async function disconnect () {
      utils.logTime('device disconnected')
      me._isOpen = false
      if (me.charNotify) {
        if (gattIsConnected()) me.charNotify.stopNotifications()
        me.charNotify.removeEventListener('characteristicvaluechanged', gattOnNotify)
        me.charNotify = null
      }
      if (me.charWrite) me.charWrite = null
      if (me.service) me.service = null
      if (me.device) {
        me.device.removeEventListener('gattserverdisconnected', disconnect)
        if (gattIsConnected()) me.device.gatt.disconnect()
        me.device = null
      }
    }

    function toCanonicalUUID (uuid) {
      return _.isInteger(uuid) ? BluetoothUUID.canonicalUUID(uuid) : uuid
    }

    /**
     * Open the connection of adapter.
     * @memberof Pn532WebbleAdapter
     * @instance
     * @async
     * @returns {Promise<null>} Resolve after finished.
     */
    async function connect () {
      if (!await isSupported()) throw new Error('WebBLE not supported')

      // request device
      me.device = await navigator.bluetooth.requestDevice({
        filters: BLESERIAL_FILTERS,
        optionalServices: deviceOptionalServices,
      })
      if (!me.device) throw new Error('no device')
      utils.logTime(`device selected, name = ${me.device.name}, id = ${me.device.id}`)

      // connect gatt
      for (let i = 0; !gattIsConnected() && i < 3; i++) {
        try {
          utils.logTime(`try to connect gatt (${i + 1})`)
          await me.device.gatt.connect()
          await utils.sleep(500)
        } catch (err) {}
      }
      if (!gattIsConnected()) throw new Error('Failed to connect gatt')
      me.device.addEventListener('gattserverdisconnected', disconnect)

      const serviceUuids = _.map(await me.device.gatt.getPrimaryServices(), 'uuid')

      // find serial over WebBLE
      for (const uuid of BLESERIAL_UUID) {
        if (!_.includes(serviceUuids, toCanonicalUUID(uuid.serv))) continue
        me.service = await me.device.gatt.getPrimaryService(uuid.serv)
        me.charNotify = await me.service.getCharacteristic(uuid.notify)
        if (!me.charNotify?.properties?.notify) continue
        me.charWrite = await me.service.getCharacteristic(uuid.write)
        if (!me.charWrite?.properties?.write) continue
        me.charNotify.addEventListener('characteristicvaluechanged', gattOnNotify)
        await me.charNotify.startNotifications()
        utils.logTime(`gatt connected, serv = 0x${uuid.serv.toString(16)}, notify = 0x${uuid.notify.toString(16)}, write = 0x${uuid.write.toString(16)}`)

        me._isOpen = true
        break
      }
      if (isOpen()) {
        await pn532.sendCommandWakeup()
        await pn532.resetSettings()
      } else {
        await disconnect()
        throw new Error('Serial over WebBLE not supported')
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
