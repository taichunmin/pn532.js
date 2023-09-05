<div align="center">

<h1>PN532.js</h1>

<p>PN532.js is a JavaScript library for PN532 base on Web Bluetooth and Web Serial.</p>

[API Reference](https://taichunmin.idv.tw/pn532.js/docs/) | [Example](https://taichunmin.idv.tw/pn532.js/docs/#example)

[![npm version](https://img.shields.io/npm/v/pn532.js.svg?logo=npm)](https://www.npmjs.org/package/pn532.js)
[![jsdelivr hits](https://img.shields.io/jsdelivr/npm/hm/pn532.js?logo=jsdelivr)](https://www.jsdelivr.com/package/npm/pn532.js)
[![Build status](https://img.shields.io/github/actions/workflow/status/taichunmin/pn532.js/ci.yml?branch=master)](https://github.com/taichunmin/pn532.js/actions/workflows/ci.yml)
[![code coverage](https://img.shields.io/coverallsCoverage/github/taichunmin/pn532.js)](https://coveralls.io/github/taichunmin/pn532.js)
[![install size](https://img.shields.io/badge/dynamic/json?url=https://packagephobia.com/v2/api.json?p=pn532.js&query=$.install.pretty&label=install%20size)](https://packagephobia.now.sh/result?p=pn532.js)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/pn532.js)](https://bundlephobia.com/package/pn532.js@latest)
[![npm downloads](https://img.shields.io/npm/dm/pn532.js.svg)](https://npm-stat.com/charts.html?package=pn532.js)
[![code helpers](https://www.codetriage.com/taichunmin/pn532.js/badges/users.svg)](https://www.codetriage.com/taichunmin/pn532.js)
[![Known Vulnerabilities](https://snyk.io/test/npm/pn532.js/badge.svg)](https://snyk.io/test/npm/pn532.js)

</div>

## Browser & OS compatibility

### SerialPort (Node.js)

[Node SerialPort](https://serialport.io/docs/) is a JavaScript library for connecting to serial ports that works in NodeJS and Electron.

### Web Bluetooth API

A subset of the Web Bluetooth API is available in ChromeOS, Chrome for Android 6.0, Mac (Chrome 56) and Windows 10 (Chrome 70). See MDN's [Browser compatibility](https://developer.mozilla.org/docs/Web/API/Web_Bluetooth_API#Browser_compatibility) table for more information.

For Linux and earlier versions of Windows, enable the `#experimental-web-platform-features` flag in `about://flags`.

### Web Serial API

The Web Serial API is available on all desktop platforms (ChromeOS, Linux, macOS, and Windows) in Chrome 89. See MDN's [Browser compatibility](https://developer.mozilla.org/docs/Web/API/Serial#browser_compatibility) table for more information.

### Web Serial API Polyfill

On Android, support for USB-based serial ports is possible using the WebUSB API and the [Serial API polyfill](https://github.com/google/web-serial-polyfill). This polyfill is limited to hardware and platforms where the device is accessible via the WebUSB API because it has not been claimed by a built-in device driver.

## Prepare PN532 hardware

PN532.js support Web Serial and Web Bluetooth. You can connect PN532 to PC via an USB2TTL module (e.g. `CH340`, `PL2303`) or via BLE UART module (e.g. `JDY-33`, `HC-08`).

See Mtools Tec's [How to make PN532 work on Bluetooth](https://shop.mtoolstec.com/how-to-make-pn532-work-on-bluetooth.html) and [How To Test PN532 Working With Bluetooth Module?](https://shop.mtoolstec.com/how-to-test-pn532-working-with-bluetooth-module.html) for more information.

## Installing

### Package manager

Using npm:

```bash
$ npm install pn532.js

# Also install SerialPort if you want to run in node.js
$ npm install serialport
```

Using yarn:

```bash
$ yarn add pn532.js

# Also install SerialPort if you want to run in node.js
$ yarn add serialport
```

Once the package is installed, you can import the library using `import` or `require`:

```js
// import
import { Pn532, Packet, utils: Pn532utils } from 'pn532.js'
import Crypto1 from 'pn532.js/Crypto1.js'
import LoggerRxTx from 'pn532.js/plugin/LoggerRxTx.js'
import Pn532Hf14a from 'pn532.js/plugin/Hf14a.js'
import Pn532SerialPortAdapter from 'pn532.js/plugin/SerialPortAdapter.js'
import Pn532WebbleAdapter from 'pn532.js/plugin/WebbleAdapter.js'
import Pn532WebserialAdapter from 'pn532.js/plugin/WebserialAdapter.js'

// require
const { Pn532, Packet, utils: Pn532utils } = require('pn532.js')
const Crypto1 = require('pn532.js/Crypto1.js')
const LoggerRxTx = require('pn532.js/plugin/LoggerRxTx.js')
const Pn532Hf14a = require('pn532.js/plugin/Hf14a.js')
const Pn532SerialPortAdapter = require('pn532.js/plugin/SerialPortAdapter.js')
const Pn532WebbleAdapter = require('pn532.js/plugin/WebbleAdapter.js')
const Pn532WebserialAdapter = require('pn532.js/plugin/WebserialAdapter.js')
```

### CDN

Using jsDelivr CDN:

```html
<!-- PN532.js require lodash@4, place before any pn532 libraries -->
<script src="https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js"></script>

<!-- PN532.js Core -->
<script src="https://cdn.jsdelivr.net/npm/pn532.js@0/dist/pn532.min.js"></script>
<!-- PN532.js Crypto1 -->
<script src="https://cdn.jsdelivr.net/npm/pn532.js@0/dist/Crypto1.min.js"></script>
<!-- PN532.js Hf14a plugin -->
<script src="https://cdn.jsdelivr.net/npm/pn532.js@0/dist/plugin/Hf14a.min.js"></script>
<!-- PN532.js LoggerRxTx plugin -->
<script src="https://cdn.jsdelivr.net/npm/pn532.js@0/dist/plugin/LoggerRxTx.min.js"></script>
<!-- PN532.js WebbleAdapter plugin -->
<script src="https://cdn.jsdelivr.net/npm/pn532.js@0/dist/plugin/WebbleAdapter.min.js"></script>
<!-- PN532.js WebserialAdapter plugin -->
<script src="https://cdn.jsdelivr.net/npm/pn532.js@0/dist/plugin/WebserialAdapter.min.js"></script>
```

After the `script` tag, you can use the `PN532.js` as following:

```js
// setup
const {
  _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
  Pn532: { Pn532, Packet, utils: Pn532utils },
  Crypto1,
  Pn532Hf14a,
  Pn532LoggerRxTx,
  Pn532WebbleAdapter,
  Pn532WebserialAdapter,
} = window
```

## Getting Started

### use Adapter

A pn532 instance must register exactly one adapter plugin:

```js
// setup
const {
  _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
  Pn532: { Pn532, Packet, utils: Pn532utils },
  Crypto1,
  Pn532Hf14a,
  Pn532WebbleAdapter,
  Pn532WebserialAdapter,
} = window

// Pn532WebserialAdapter
const pn532usb = new Pn532()
pn532usb.use(new Pn532WebserialAdapter()) // A pn532 instance must register exactly one adapter plugin
console.log(JSON.stringify(await pn532usb.getFirmwareVersion())) // {"firmware":"1.6","ic":"PN532","iso14443a":true,"iso14443b":true,"iso18092":true}

// Pn532WebbleAdapter
const pn532ble = new Pn532()
pn532ble.use(new Pn532WebbleAdapter()) // A pn532 instance must register exactly one adapter plugin
console.log(JSON.stringify(await pn532ble.getFirmwareVersion())) // {"firmware":"1.6","ic":"PN532","iso14443a":true,"iso14443b":true,"iso18092":true}

// Pn532SerialPortAdapter
import Pn532SerialPortAdapter from 'pn532.js/plugin/SerialPortAdapter.js'
// Run serialport-list to list port, see https://serialport.io/docs/bin-list
const pn532node = new Pn532()
pn532node.use(new Pn532SerialPortAdapter(), { path: '/dev/tty.usbserial-120' })
console.log(JSON.stringify(await pn532node.getFirmwareVersion())) // {"firmware":"1.6","ic":"PN532","iso14443a":true,"iso14443b":true,"iso18092":true}
```

### Read UID, ATQA, SAK from Mifare Classic 1k

```js
// setup
const {
  _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
  Pn532: { Pn532, Packet, utils: Pn532utils },
  Pn532Hf14a,
  Pn532WebserialAdapter,
} = window

const pn532 = new Pn532()
pn532.use(new Pn532WebserialAdapter()) // A pn532 instance must register exactly one adapter plugin
pn532.use(new Pn532Hf14a())
console.log(JSON.stringify(await pn532.$hf14a.mfSelectCard())) // {"pack":"Packet(9): 010004080407460D6D","atqa":"Packet(2): 0004","sak":"Packet(1): 08","uid":"Packet(4): 07460D6D","rats":"Packet(0)"}
```

### Manipulate with MIFARE Classic 1k and MIFARE Classic DirectWrite aka Gen2 aka CUID

If you are not familiar with Chinese Magic Card, see Proxmark3's [Magic Cards Notes](https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/magic_cards_notes.md) for more information.

```js
// setup
const {
  _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
  Pn532: { Pn532, Packet, utils: Pn532utils },
  Pn532Hf14a,
  Pn532WebserialAdapter,
} = window

const pn532 = new Pn532()
pn532.use(new Pn532WebserialAdapter()) // A pn532 instance must register exactly one adapter plugin
pn532.use(new Pn532Hf14a())

const key = Packet.fromHex('FFFFFFFFFFFF')

// read a block
let resp1 = await pn532.$hf14a.mfReadBlock({ block: 0, isKb: 1, key })
console.log(resp1.hex) // 0102030404080400000000000000BEAF
console.log(resp1.inspect) // Packet(16): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF

// try to read a block with key B then Key A
let resp2 = await pn532.$hf14a.mfReadBlockKeyBA({ block: 0, ka: key, kb: key })
console.log(resp2.hex) // 0102030404080400000000000000BEAF
console.log(resp2.inspect) // Packet(16): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF

// read a sector
let resp3 = await pn532.$hf14a.mfReadSector({ sector: 0, isKb: 1, key })
console.log(JSON.stringify(resp3)) // {"data":"Packet(64): 0102030404080400000000000000BEAF... (truncated)","success":[1,1,1,1]}
console.log(resp3.data.hex) // 0102030404080400000000000000BEAF... (truncated)
console.log(resp3.data.inspect) // Packet(64): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF... (truncated)

// try to read a sector with key B then Key A
let resp4 = await pn532.$hf14a.mfReadSectorKeyBA({ sector: 0, ka: key, kb: key })
console.log(JSON.stringify(resp4)) // {"data":"Packet(64): 0102030404080400000000000000BEAF... (truncated)","success":{"key":[1,1],"read":[1,1,1,1]}}
console.log(resp4.data.hex) // 0102030404080400000000000000BEAF... (truncated)
console.log(resp4.data.inspect) // Packet(64): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF... (truncated)

// try to read a Mifare Classic 1k by keys
let resp5 = await pn532.$hf14a.mfReadCardByKeys({ sectorMax: 16, keys: [key] })
console.log(JSON.stringify(resp5)) // {"data":"Packet(1024): 0102030404080400000000000000BEAF... (truncated)","success":{"key":["Packet(6): FFFFFFFFFFFF",... (truncated)],"read":[1,1,1,1,... (truncated)]}}
console.log(resp5.data.hex) // 0102030404080400000000000000BEAF... (truncated)
console.log(resp5.data.inspect) // Packet(1024): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF... (truncated)

// write a block
const dataBlock = Packet.fromHex('000102030405060708090A0B0C0D0E0F')
await pn532.$hf14a.mfWriteBlock({ block: 1, isKb: 1, key, data: dataBlock })

// try to write a block with key B then Key A
await pn532.$hf14a.mfWriteBlockKeyBA({ block: 1, ka: key, kb: key, data: dataBlock })

// write a sector
const dataSector = new Packet(64)
dataSector.set(Packet.fromHex('FFFFFFFFFFFF08778F00FFFFFFFFFFFF'), 48)
let resp6 = await pn532.$hf14a.mfWriteSector({ sector: 1, isKb: 1, key, data: dataSector })
console.log(JSON.stringify(resp6)) // {"success":[1,1,1,1]}

// try to write a sector with key B then Key A
let resp7 = await pn532.$hf14a.mfWriteSectorKeyBA({ sector: 1, ka: key, kb: key, data: dataSector })
console.log(JSON.stringify(resp7)) // {"success":[1,1,1,1]}

// try to write a Mifare Classic 1k by keys
const dataCard = new Packet(1024)
dataCard.set(Packet.fromHex('0102030404080400000000000000BEAF'))
for (let i = 0; i < 16; i++) dataCard.set(Packet.fromHex('FFFFFFFFFFFF08778F00FFFFFFFFFFFF'), i * 64 + 48)
let resp8 = await pn532.$hf14a.mfWriteCardByKeys({ sectorMax: 16, keys: [key], data: dataCard })
console.log(JSON.stringify(resp8)) // {"success":[1,1,1,1,... (truncated)]}
```

### Manipulate with MIFARE Classic Gen1A aka UID

If you are not familiar with Chinese Magic Card, see Proxmark3's [Magic Cards Notes](https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/magic_cards_notes.md) for more information.

```js
// setup
const {
  _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
  Pn532: { Pn532, Packet, utils: Pn532utils },
  Pn532Hf14a,
  Pn532WebserialAdapter,
} = window

const pn532 = new Pn532()
pn532.use(new Pn532WebserialAdapter()) // A pn532 instance must register exactly one adapter plugin
pn532.use(new Pn532Hf14a())

// read a block
let resp1 = await pn532.$hf14a.mfReadBlockGen1a({ block: 0 })
console.log(resp1.hex) // 0102030404080400000000000000BEAF
console.log(resp1.inspect) // Packet(16): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF

// read a sector
let resp2 = await pn532.$hf14a.mfReadSectorGen1a({ sector: 0 })
console.log(JSON.stringify(resp2)) // {"data":"Packet(64): 0102030404080400000000000000BEAF... (truncated)","success":[1,1,1,1]}
console.log(resp2.data.hex) // 0102030404080400000000000000BEAF... (truncated)
console.log(resp2.data.inspect) // Packet(64): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF... (truncated)

// read a Mifare Classic 1k Gen1A
let resp3 = await pn532.$hf14a.mfReadCardGen1a({ sectorMax: 16 })
console.log(JSON.stringify(resp3)) // {"data":"Packet(1024): 0102030404080400000000000000BEAF... (truncated)","success":[1,1,1,1,... (truncated)]}
console.log(resp3.data.hex) // 0102030404080400000000000000BEAF... (truncated)
console.log(resp3.data.inspect) // Packet(1024): 01 02 03 04 04 08 04 00 00 00 00 00 00 00 BE AF... (truncated)

// write a block
const dataBlock = Packet.fromHex('000102030405060708090A0B0C0D0E0F')
await pn532.$hf14a.mfWriteBlockGen1a({ block: 1, data: dataBlock })

// write a sector
const dataSector = new Packet(64)
dataSector.set(Packet.fromHex('FFFFFFFFFFFF08778F00FFFFFFFFFFFF'), 48)
let resp4 = await pn532.$hf14a.mfWriteSectorGen1a({ sector: 1, data: dataSector })
console.log(JSON.stringify(resp4)) // {"success":[1,1,1,1]}

// write a Mifare Classic 1k Gen1A
const dataCard = new Packet(1024)
dataCard.set(Packet.fromHex('0102030404080400000000000000BEAF'))
for (let i = 0; i < 16; i++) dataCard.set(Packet.fromHex('FFFFFFFFFFFF08778F00FFFFFFFFFFFF'), i * 64 + 48)
let resp5 = await pn532.$hf14a.mfWriteCardGen1a({ sectorMax: 16, data: dataCard })
console.log(JSON.stringify(resp5)) // {"success":[1,1,1,1,... (truncated)]}

// set a random UID
await pn532.$hf14a.mfSetUidGen1a({ uid: new Packet(_.times(4, () => _.random(0, 0xFF))) })

// wipe a Mifare Classic 1k Gen1A
let resp6 = await pn532.$hf14a.mfWipeGen1a({ sectorMax: 16, uid: Packet.fromHex('01020304') })
console.log(JSON.stringify(resp6)) // {"success":[1,1,1,1,... (truncated)]}
```

## Related links

* [PN532 User Manual v1.6 | NXP](https://www.nxp.com/docs/en/user-guide/141520.pdf)
* [PN532/C1 Product data sheet v3.6 | NXP](https://www.nxp.com/docs/en/nxp/data-sheets/PN532_C1.pdf)
* [Mifare Classic 1k ev1 v3.2 | NXP](https://www.nxp.com/docs/en/data-sheet/MF1S50YYX_V1.pdf)
* [Mifare Classic 4k ev1 v3.2 | NXP](https://www.nxp.com/docs/en/data-sheet/MF1S70YYX_V1.pdf)
* [Mifare Identifcation Procedure - AN10833 | NXP](https://www.nxp.com/docs/en/application-note/AN10833.pdf)
* [MIFARE ISO/IEC 14443 PICC selection - AN10834 | NXP](https://www.nxp.com/docs/en/application-note/AN10834.pdf)
* [MIFARE product and handling of UIDs - AN10927 | NXP](https://www.nxp.com/docs/en/application-note/AN10927.pdf)
* [A 2018 practical guide to hacking NFC/RFID](https://smartlockpicking.com/slides/Confidence_A_2018_Practical_Guide_To_Hacking_RFID_NFC.pdf)
* [Magic Cards Notes](https://github.com/RfidResearchGroup/proxmark3/blob/master/doc/magic_cards_notes.md)
* [elechouse/PN532: NFC library for Arduino](https://github.com/elechouse/PN532)
* [nfc-tools/libnfc](https://github.com/nfc-tools/libnfc)
* [RfidResearchGroup/RFIDtools: RFID Tools android app](https://github.com/RfidResearchGroup/RFIDtools)
