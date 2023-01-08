/**
 * @module pn532.js/Packet
 * @example
 * import Packet from 'pn532.js/Packet'
 */
import _ from 'lodash'

const BASE64URL_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * The Packet class extends Uint8Array, contains some member function of DataView and add some helper function.
 * @example
 * // new Packet()
 * const pack = new Packet()
 * @example
 * // new Packet(length)
 * // @param {!number} length When called with a `length` argument, an internal array buffer is created in memory, of size `length` multiplied by  `BYTES_PER_ELEMENT` bytes, containing zeros.
 * const pack = new Packet(1)
 * @example
 * // new Packet(typedArray)
 * // @param {!TypedArray} typedArray When called with a `typedArray` argument, which can be an object of any of the non-bigint typed-array types (such as `Int32Array`), the `typedArray` get copied into a new typed array. Each value in `typedArray` is converted to the corresponding type of the constructor before being copied into the new array. The length of the new typed array will be same as the length of the `typedArray` argument.
 * const pack = new Packet(new Uint8Array([1]))
 * @example
 * // new Packet(buffer, byteOffset=, length=)
 * // @param {!ArrayBuffer} buffer When called with a `buffer`, and optionally a `byteOffset` and a `length` argument, a new typed array view is created that views the specified [`ArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer). The `byteOffset` and `length` parameters specify the memory range that will be exposed by the typed array view. If both are omitted, all of `buffer` is viewed; if only `length` is omitted, the remainder of `buffer` is viewed.
 * // @param {number} [byteOffset=0] must be a integer, default to 0
 * // @param {number} [length=buffer.byteLength] must be a integer, default to `buffer.byteLength`
 * const pack = new Packet((new Uint8Array([1])).buffer)
 */
export default class Packet extends Uint8Array {
  constructor (...args) {
    super(...args)
    this.dv = new DataView(this.buffer, this.byteOffset, this.length)
  }

  /**
   * Returns a new Packet object initialized from one of the `ArrayBuffer` views
   * @param {TypedArray|DataView} view one of the `ArrayBuffer` views, such as [typed array objects](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray) or a [`DataView`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/DataView).
   * @example
   * const pack = Packet.fromView(new Uint8Array([1]))
   * @returns {Packet} a new Packet object initialized from one of the `ArrayBuffer` views
   */
  static fromView (view) {
    if (!ArrayBuffer.isView(view)) throw new TypeError('invalid view')
    return new Packet(view.buffer, view.byteOffset, view.byteLength)
  }

  /**
   * Returns a new Packet object initialized from a string of hex numbers.
   * @param {!string} hex String containing hex numbers.
   * @param {boolean} [reverse=false] `true` if the string of hex numbers is little endian.
   * @example
   * console.log(Packet.fromHex('01020304').hex)
   * // 01020304
   * console.log(Packet.fromHex('01020304', true).hex)
   * // 04030201
   * @returns {Packet} a new Packet object initialized from a string of hex numbers.
   */
  static fromHex (hex, reverse = false) {
    hex = hex.replace(/[^0-9A-Fa-f]/g, '')
    if (hex.length & 1) throw new TypeError('invalid hex string')
    const pack = new Packet(hex.length >>> 1)
    for (let i = 0; i < pack.length; i++) pack[i] = parseInt(hex.substr(i << 1, 2), 16)
    if (reverse) pack.reverse()
    return pack
  }

  /**
   * Returns a new Packet object initialized from a utf8 string.
   * @param {!string} utf8 String with utf8 encoding.
   * @example
   * const pack = Packet.fromUtf8('Hello world.')
   * @returns {Packet} a new Packet object initialized from a utf8 string.
   */
  static fromUtf8 (utf8) {
    return Packet.fromView(new TextEncoder().encode(utf8))
  }

  /**
   * Returns a new Packet object merge from two or more Packets
   * @param  {...Packet} packs two or more Packets to be merged
   * @example
   * const pack = Packet.merge(Packet.fromUtf8('Hello '), Packet.fromUtf8('world.'))
   * @returns {Packet} a new Packet object merge from two or more Packets
   */
  static merge (...packs) {
    if (packs.length < 2) return packs.length ? packs[0] : new Packet()
    const merged = new Packet(_.sumBy(packs, 'length'))
    _.reduce(packs, (offset, pack) => {
      merged.set(pack, offset)
      return offset + pack.length
    }, 0)
    return merged
  }

  /**
   * Determines whether `pack` is instance of `Packet` and `pack.length` is equal to `len`. `pack.length` will not be validated if `len` is `null`.
   * @param {*} pack a data to be validate
   * @param {number} [len=null] `pack.length` should be integer or `null`. `pack.length` will not be validated if `len` is `null`.
   * @example
   * if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
   * @returns {boolean} Indicating whether or not `pack` is an instance of `Packet` and the `pack.length` equals to `len`.
   */
  static isLen (pack, len = null) {
    return (pack instanceof Packet) && (_.isNil(len) || pack.length === len)
  }

  /**
   * Determines whether the two Packet has the same data.
   * @param {*} other The other value to compare.
   * @example
   * const pack1 = new Packet([1, 2])
   * const pack2 = new Packet([3, 4])
   * if (!pack1.isEqual(pack2)) throw new Error('not equal')
   * @returns {boolean} Indicating whether or not the other value has the same data.
   */
  isEqual (other) {
    return Packet.isLen(other, this.length) && this.every((v, k) => v === other[k])
  }

  /**
   * Creates a new array of Packet with length of `bytesPerChunk`. The final chunk will be the remaining data if `length` isn't multiple of `bytesPerChunk`.
   * @param {number} bytesPerChunk must be a integer.
   * @example
   * console.log(JSON.stringify(Packet.fromHex('00010203040506').chunk(3)))
   * // ["Packet(3): 000102","Packet(3): 030405","Packet(1): 06"]
   * @returns {Packet[]} A new array of Packet
   */
  chunk (bytesPerChunk) {
    if (bytesPerChunk < 1) throw new TypeError('invalid bytesPerChunk')
    const chunks = []
    for (let i = 0; i < this.length; i += bytesPerChunk) chunks.push(this.subarray(i, i + bytesPerChunk))
    return chunks
  }

  /**
   * The xor value of every byte in the Packet.
   * @example
   * console.log(Packet.fromHex('01020304').xor)
   * // 4
   * @member {number}
   */
  get xor () {
    return _.reduce(this, (xor, v) => xor ^ v, 0)
  }

  /**
   * hex string of the Packet
   * @example
   * console.log(Packet.fromHex('123456').hex)
   * // 123456
   * @member {string}
   */
  get hex () { return _.map(this, b => (b + 0x100).toString(16).slice(-2)).join('').toUpperCase() }

  /**
   * reversed hex string of the Packet
   * @example
   * console.log(Packet.fromHex('123456').rhex)
   * // 563412
   * @member {string}
   */
  get rhex () { return _.map(this, b => (b + 0x100).toString(16).slice(-2)).reverse().join('').toUpperCase() }

  /**
   * A string with format `Packet(length): hex`
   * @example
   * console.log(Packet.fromHex('123456').inspect)
   * // Packet(3): 12 34 56
   * @member {string}
   */
  get inspect () { return `Packet(${this.length}): ${_.map(this, b => (b + 0x100).toString(16).slice(-2)).join(' ').toUpperCase()}` }

  /**
   * utf8 string of the Packet
   * @example
   * console.log(Packet.fromHex('616263').utf8)
   * // abc
   * @member {string}
   */
  get utf8 () { return new TextDecoder().decode(this) }

  /**
   * base64url string of the Packet
   * @example
   * console.log(Packet.fromHex('616263').base64url)
   * // YWJj
   * @member {string}
   */
  get base64url () {
    const tmp = []
    for (let i = 0; i < this.length; i += 3) {
      let u24 = 0
      for (let j = 0; j < 3; j++) u24 |= ((i + j) < this.length ? this[i + j] : 0) << (16 - j * 8)
      tmp.push(_.times(Math.min(this.length - i + 1, 4), j => BASE64URL_CHAR[(u24 >>> (18 - 6 * j)) & 0x3F]).join(''))
    }
    return tmp.join('')
  }

  /**
   * the member function will be invoked when using `JSON.stringify`
   * @returns {string} A string with format `Packet(length): hex`
   */
  toJSON () { return this.length ? `Packet(${this.length}): ${this.hex}` : 'Packet(0)' }

  /**
   * the member function will be invoked when convert Packet to string.
   * @returns {string} A string with format `Packet(length): hex`
   */
  toString () { return this.toJSON() }

  // DataView getter
  dvGetter (key, byteOffset, littleEndian = true) {
    if (byteOffset < 0) byteOffset += this.dv.byteLength
    return this.dv[key](byteOffset, littleEndian)
  }

  /**
   * Get a signed 64-bit integer (long long) at the specified byte offset from the start of the Packet.
   * @function getBigInt64
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 64-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {BigInt} A BigInt.
   */
  getBigInt64 (...args) { return this.dvGetter('getBigInt64', ...args) }

  /**
   * Get an unsigned 64-bit integer (unsigned long long) at the specified byte offset from the start of the Packet.
   * @function getBigUint64
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 64-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {BigInt} A BigInt.
   */
  getBigUint64 (...args) { return this.dvGetter('getBigUint64', ...args) }

  /**
   * Get a signed 32-bit float (float) at the specified byte offset from the start of the Packet.
   * @function getFloat32
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 32-bit float is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} A signed 32-bit float number.
   */
  getFloat32 (...args) { return this.dvGetter('getFloat32', ...args) }

  /**
   * Get a signed 64-bit float (double) at the specified byte offset from the start of the Packet.
   * @function getFloat64
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 64-bit float is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} A signed 64-bit float number.
   */
  getFloat64 (...args) { return this.dvGetter('getFloat64', ...args) }

  /**
   * Get a signed 16-bit integer (short) at the specified byte offset from the start of the Packet.
   * @function getInt16
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 16-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} A signed 16-bit integer number.
   */
  getInt16 (...args) { return this.dvGetter('getInt16', ...args) }

  /**
   * Get a signed 32-bit integer (long) at the specified byte offset from the start of the Packet.
   * @function getInt32
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 32-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} A signed 32-bit integer number.
   */
  getInt32 (...args) { return this.dvGetter('getInt32', ...args) }

  /**
   * Get a signed 8-bit integer (byte) at the specified byte offset from the start of the Packet.
   * @function getInt8
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in byte, from the start of the Packet where to read the data.
   * @returns {number} An unsigned 8-bit integer number.
   */
  getInt8 (...args) { return this.dvGetter('getInt8', ...args) }

  /**
   * Get an unsigned 16-bit integer (unsigned short) at the specified byte offset from the start of the Packet.
   * @function getUint16
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in byte, from the start of the Packet where to read the data.
   * @param  {boolean} [littleEndian=true] Indicates whether the 16-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} An unsigned 16-bit integer number.
   */
  getUint16 (...args) { return this.dvGetter('getUint16', ...args) }

  /**
   * Get an unsigned 32-bit integer (unsigned long) at the specified byte offset from the start of the Packet.
   * @function getUint32
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in byte, from the start of the Packet where to read the data.
   * @param  {boolean} [littleEndian=true] Indicates whether the 32-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} An unsigned 32-bit integer number.
   */
  getUint32 (...args) { return this.dvGetter('getUint32', ...args) }

  /**
   * Get an unsigned 8-bit integer (unsigned byte) at the specified byte offset from the start of the Packet.
   * @function getUint8
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in byte, from the start of the Packet where to read the data.
   * @returns {number} An unsigned 8-bit integer number.
   */
  getUint8 (...args) { return this.dvGetter('getUint8', ...args) }

  // DataView setter
  dvSetter (key, byteOffset, value, littleEndian = true) {
    if (byteOffset < 0) byteOffset += this.dv.byteLength
    this.dv[key](byteOffset, value, littleEndian)
    return this
  }

  /**
   * Store a signed 64-bit integer (long long) value at the specified byte offset from the start of the Packet.
   * @function setBigInt64
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {BigInt} value The value to set as a [BigInt](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/BigInt). The highest possible value that fits in a signed 64-bit integer is `2n ** (64n -1n) - 1n` (`9223372036854775807n`). Upon overflow, it will be negative (`-9223372036854775808n`).
   * @param  {boolean} [littleEndian=true] Indicates whether the 64-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setBigInt64 (...args) { return this.dvSetter('setBigInt64', ...args) }

  /**
   * Store an unsigned 64-bit integer (unsigned long long) value at the specified byte offset from the start of the Packet.
   * @function setBigUint64
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {BigInt} value The highest possible value that fits in an unsigned 64-bit integer is `2n ** 64n - 1n` (`18446744073709551615n`). Upon overflow, it will be zero (`0n`).
   * @param  {boolean} [littleEndian=true] Indicates whether the 64-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setBigUint64 (...args) { return this.dvSetter('setBigUint64', ...args) }

  /**
   * Store a signed 32-bit float (float) value at the specified byte offset from the start of the Packet.
   * @function setFloat32
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 32-bit float is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setFloat32 (...args) { return this.dvSetter('setFloat32', ...args) }

  /**
   * Store a signed 64-bit float (double) value at the specified byte offset from the start of the Packet.
   * @function setFloat64
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 64-bit float is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setFloat64 (...args) { return this.dvSetter('setFloat64', ...args) }

  /**
   * Store a signed 16-bit integer (short) value at the specified byte offset from the start of the Packet.
   * @function setInt16
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 16-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setInt16 (...args) { return this.dvSetter('setInt16', ...args) }

  /**
   * Store a signed 32-bit integer (long) value at the specified byte offset from the start of the Packet.
   * @function setInt32
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 32-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setInt32 (...args) { return this.dvSetter('setInt32', ...args) }

  /**
   * Store a signed 8-bit integer (byte) value at the specified byte offset from the start of the Packet.
   * @function setInt8
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   */
  setInt8 (...args) { return this.dvSetter('setInt8', ...args) }

  /**
   * Store an unsigned 16-bit integer (unsigned short) value at the specified byte offset from the start of the Packet.
   * @function setUint16
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 16-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setUint16 (...args) { return this.dvSetter('setUint16', ...args) }

  /**
   * Store an unsigned 32-bit integer (unsigned long) value at the specified byte offset from the start of the Packet.
   * @function setUint32
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 32-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setUint32 (...args) { return this.dvSetter('setUint32', ...args) }

  /**
   * Store an unsigned 8-bit integer (unsigned byte) value at the specified byte offset from the start of the Packet.
   * @function setUint8
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   */
  setUint8 (...args) { return this.dvSetter('setUint8', ...args) }

  /**
   * Get an unsigned 24-bit integer at the specified byte offset from the start of the Packet.
   * @function getUint24
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in byte, from the start of the Packet where to read the data.
   * @param  {boolean} [littleEndian=true] Indicates whether the 24-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   * @returns {number} An unsigned 24-bit integer number.
   */
  getUint24 (offset, little = true) {
    const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1]
    return (this.getUint8(p8) << 16) | this.getUint16(p16, little)
  }

  /**
   * Store an unsigned 24-bit integer value at the specified byte offset from the start of the Packet.
   * @function setUint24
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 24-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setUint24 (offset, value, little = true) {
    const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1]
    this.setUint8(p8, (value >>> 16) & 0xFF)
    this.setUint16(p16, value & 0xFFFF, little)
    return this
  }

  /**
   * Get a signed 24-bit integer at the specified byte offset from the start of the Packet.
   * @function getInt24
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to read the data from.
   * @param  {boolean} [littleEndian=true] Indicates whether the 24-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is read.
   * @returns {number} A signed 24-bit integer number.
   */
  getInt24 (offset, little = true) {
    const u24 = this.getUint24(offset, little)
    return u24 - (u24 > 0x7FFFFF ? 0x1000000 : 0)
  }

  /**
   * Store a signed 24-bit integer value at the specified byte offset from the start of the Packet.
   * @function setInt24
   * @memberof Packet
   * @instance
   * @param  {number} byteOffset The offset, in bytes, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=true] Indicates whether the 24-bit int is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` or `undefined`, a big-endian value is written.
   */
  setInt24 (offset, value, little = true) {
    return this.setUint24(offset, value & 0xFFFFFF, little)
  }

  /**
   * Get a bit value at the specified bit offset from the start of the Packet.
   * @function getBit
   * @memberof Packet
   * @instance
   * @param {number} bitOffset The offset, in bits, from the start of the Packet to read the data from.
   * @param {number} [littleEndian=false] Indicates whether the bit value is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` a big-endian value is written.
   * @returns {number} A bit value.
   */
  getBit (bitOffset, little = false) {
    const byteOffset = little ? bitOffset >>> 3 : this.length - (bitOffset >>> 3) - 1
    return (this[byteOffset] >>> (bitOffset & 7)) & 1
  }

  /**
   * Store a bit value at the specified bit offset from the start of the Packet.
   * @function setBit
   * @memberof Packet
   * @instance
   * @param  {number} bitOffset The offset, in bits, from the start of the Packet to store the data from.
   * @param  {number} value The value to set.
   * @param  {boolean} [littleEndian=false] Indicates whether the bit value is stored in [little- or big-endian](https://developer.mozilla.org/docs/Glossary/Endianness) format. If `false` a big-endian value is written.
   */
  setBit (bitOffset, value, little = false) {
    const byteOffset = little ? bitOffset >>> 3 : this.length - (bitOffset >>> 3) - 1
    bitOffset &= 7
    value = value ? 1 : 0
    this[byteOffset] = (this[byteOffset] & ~(1 << bitOffset)) | (value << bitOffset)
    return this
  }
}
