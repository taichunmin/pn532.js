import Pn532 from '../src/Pn532.js'
import Pn532SerialPortAdapter from '../src/plugin/SerialPortAdapter.js'

async function main () {
  const pn532 = new Pn532()
  const path = process.env.SERIAL_PATH
  if (!path) throw new Error('env.SERIAL_PATH is not defined')
  console.log(`path = ${path}`)
  pn532.use(new Pn532SerialPortAdapter(), { path })
  console.log(JSON.stringify(await pn532.getFirmwareVersion()))
  process.exit(0)
}

// run serialport-list to list port, see https://serialport.io/docs/bin-list
// SERIAL_PATH='/dev/tty.usbserial-120' node examples/serialport.js
main().catch(console.error)
