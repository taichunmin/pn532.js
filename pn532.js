(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('lodash')) :
  typeof define === 'function' && define.amd ? define(['exports', 'lodash'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Pn532 = {}, global._));
})(this, (function (exports, _) { 'use strict';

  /**
   * @module pn532.js/Packet
   * @example
   * import Packet from 'pn532.js/Packet'
   */

  const BASE64URL_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

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
  class Packet extends Uint8Array {
    constructor (...args) {
      super(...args);
      this.dv = new DataView(this.buffer, this.byteOffset, this.length);
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
      hex = hex.replace(/[^0-9A-Fa-f]/g, '');
      if (hex.length & 1) throw new TypeError('invalid hex string')
      const pack = new Packet(hex.length >>> 1);
      for (let i = 0; i < pack.length; i++) pack[i] = parseInt(hex.substr(i << 1, 2), 16);
      if (reverse) pack.reverse();
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
      const merged = new Packet(_.sumBy(packs, 'length'));
      _.reduce(packs, (offset, pack) => {
        merged.set(pack, offset);
        return offset + pack.length
      }, 0);
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
      const chunks = [];
      for (let i = 0; i < this.length; i += bytesPerChunk) chunks.push(this.subarray(i, i + bytesPerChunk));
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
      const tmp = [];
      for (let i = 0; i < this.length; i += 3) {
        let u24 = 0;
        for (let j = 0; j < 3; j++) u24 |= ((i + j) < this.length ? this[i + j] : 0) << (16 - j * 8);
        tmp.push(_.times(Math.min(this.length - i + 1, 4), j => BASE64URL_CHAR[(u24 >>> (18 - 6 * j)) & 0x3F]).join(''));
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
      if (byteOffset < 0) byteOffset += this.dv.byteLength;
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
      if (byteOffset < 0) byteOffset += this.dv.byteLength;
      this.dv[key](byteOffset, value, littleEndian);
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
      const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1];
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
      const [p8, p16] = little ? [offset + 2, offset] : [offset, offset + 1];
      this.setUint8(p8, (value >>> 16) & 0xFF);
      this.setUint16(p16, value & 0xFFFF, little);
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
      const u24 = this.getUint24(offset, little);
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
     * Get a bit value at the specified bit offset from the Packet.
     * @function getBit
     * @memberof Packet
     * @instance
     * @param {number} bitOffset The offset, in bits, from the Packet to read the data from.
     * @param {number} [lsb=false] Indicates whether the bit value is stored in LSB (Least Significant Bit) format. If `false` a MSB (Most Significant Bit) format is used.
     * @returns {number} A bit value.
     */
    getBit (bitOffset, lsb = false) {
      bitOffset = (lsb ? bitOffset : this.length * 8 - bitOffset - 1) ^ 7;
      return (this[bitOffset >>> 3] >>> (bitOffset & 7)) & 1
    }

    /**
     * Store a bit value at the specified bit offset from the Packet.
     * @function setBit
     * @memberof Packet
     * @instance
     * @param {number} bitOffset The offset, in bits, from the Packet to store the data from.
     * @param {number} value The value to be set.
     * @param {number} [lsb=false] Indicates whether the bit value is stored in LSB (Least Significant Bit) format. If `false` a MSB (Most Significant Bit) format is used.
     */
    setBit (bitOffset, value, lsb = false) {
      bitOffset = (lsb ? bitOffset : this.length * 8 - bitOffset - 1) ^ 7;
      const oldBit = (this[bitOffset >>> 3] >>> (bitOffset & 7)) & 1;
      if (oldBit ^ (value ? 1 : 0)) this[bitOffset >>> 3] ^= 1 << (bitOffset & 7);
      return this
    }
  }

  /**
   * @module pn532.js/utils
   * @example
   * import * as Pn532Utils from 'pn532.js/utils'
   */

  const logTime = (...args) => console.log(`[${new Date().toTimeString().slice(0, 8)}]`, ...args);

  const sleep = t => new Promise(resolve => setTimeout(resolve, t));

  class RethrownError extends Error {
    constructor (err) {
      if (!(err instanceof Error)) throw new TypeError('invalid err type')
      super(err.message);
      this.name = this.constructor.name;
      this.originalError = err;
      this.stack = `${this.stack}\n${err.stack}`;
    }
  }

  const retry = async (fn, times = 3) => {
    if (times < 1) throw new TypeError('invalid times')
    let lastErr = null;
    while (times--) {
      try {
        return await fn()
      } catch (err) {
        lastErr = err;
      }
    }
    throw new RethrownError(lastErr)
  };

  const middlewareCompose = middleware => {
    // 型態檢查
    if (!_.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
    if (_.some(middleware, fn => !_.isFunction(fn))) throw new TypeError('Middleware must be composed of functions!')

    return async (context = {}, next) => {
      const cloned = [...middleware, ...(_.isFunction(next) ? [next] : [])];
      if (!cloned.length) return
      const executed = _.times(cloned.length + 1, () => 0);
      const dispatch = async cur => {
        if (executed[cur] !== 0) throw new Error(`middleware[${cur}] called multiple times`)
        if (cur >= cloned.length) {
          executed[cur] = 2;
          return
        }
        try {
          executed[cur] = 1;
          const result = await cloned[cur](context, () => dispatch(cur + 1));
          if (executed[cur + 1] === 1) throw new Error(`next() in middleware[${cur}] should be awaited`)
          executed[cur] = 2;
          return result
        } catch (err) {
          executed[cur] = 3;
          if (err.stack) err.stack = err.stack.replace(/at async dispatch[^\n]+\n[^\n]+\n\s*/g, '');
          throw err
        }
      };
      return await dispatch(0)
    }
  };

  var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    RethrownError: RethrownError,
    logTime: logTime,
    middlewareCompose: middlewareCompose,
    retry: retry,
    sleep: sleep
  });

  /**
   * @module pn532.js/pn532
   * @example
   * import Pn532 from 'pn532.js/pn532'
   */

  const PN532_ERROR = _.fromPairs(_.map([
    ['01', 'Time Out, the target has not answered'],
    ['02', 'A CRC error has been detected by the CIU'],
    ['03', 'A Parity error has been detected by the CIU'],
    ['04', 'During an anti-collision/select operation (ISO/IEC14443-3 Type A and ISO/IEC18092 106 kbps passive mode), an erroneous Bit Count has been detected'],
    ['05', 'Framing error during Mifare operation'],
    ['06', 'An abnormal bit-collision has been detected during bit wise anti-collision at 106 kbps'],
    ['07', 'Communication buffer size insufficient'],
    ['09', 'RF Buffer overflow has been detected by the CIU (bit BufferOvfl of the register CIU_Error)'],
    ['0A', 'In active communication mode, the RF field has not been switched on in time by the counterpart (as defined in NFCIP-1 standard)'],
    ['0B', 'RF Protocol error (description of the CIU_Error register)'],
    ['0D', 'Temperature error: the internal temperature sensor has detected overheating, and therefore has automatically switched off the antenna drivers'],
    ['0E', 'Internal buffer overflow'],
    ['10', 'Invalid parameter (range, format, ...)'],
    ['12', 'DEP Protocol: The PN532 configured in target mode does not support the command received from the initiator (the command received is not one of the following: ATR_REQ, WUP_REQ, PSL_REQ, DEP_REQ, DSL_REQ, RLS_REQ)'],
    ['13', 'DEP Protocol, Mifare or ISO/IEC14443-4: The data format does not match to the specification. Depending on the RF protocol used, it can be: Bad length of RF received frame, Incorrect value of PCB or PFB, Invalid or unexpected RF received frame, NAD or DID incoherence.'],
    ['14', 'Mifare: Authentication error'],
    ['23', 'ISO/IEC14443-3: UID Check byte is wrong'],
    ['25', 'DEP Protocol: Invalid device state, the system is in a state which does not allow the operation'],
    ['26', 'Operation not allowed in this configuration (host controller interface)'],
    ['27', 'This command is not acceptable due to the current context of the PN532 (Initiator vs. Target, unknown target number, Target not in the good state, ...)'],
    ['29', 'The PN532 configured as target has been released by its initiator'],
    ['2A', 'PN532 and ISO/IEC14443-3B only: the ID of the card does not match, meaning that the expected card has been exchanged with another one.'],
    ['2B', 'PN532 and ISO/IEC14443-3B only: the card previously activated has disappeared.'],
    ['2C', 'Mismatch between the NFCID3 initiator and the NFCID3 target in DEP 212/424 kbps passive.'],
    ['2D', 'An over-current event has been detected'],
    ['2E', 'NAD missing in DEP frame'],
  ], row => [_.parseInt(row[0], 16), row[1]]));

  const hasPn532StatusError = status => {
    const code = status & 0x3F;
    if (!code) return null
    const errMsg = PN532_ERROR[code] ?? `unknown error code: ${code}`;
    return _.set(new Error(`${errMsg}, nad = ${(status & 0x80) ? 1 : 0}, mi = ${(status & 0x40) ? 1 : 0}`, 'data.status', status))
  };

  /**
   * Interface of PN532 Frame. Please use {@link Pn532Frame.create} to create a new instance.
   * @interface
   * @class
   * @param {Packet} pack A PN532 Frame Data.
   */
  class Pn532Frame {
    constructor (pack) {
      if (!Packet.isLen(pack)) throw new TypeError('invalid pack type')
      /** @member {Packet} */
      this.pack = pack;
    }

    /**
     * Create a new `Pn532FrameNormal` or `Pn532FrameExtended` instance depends on data in `pack`.
     * @param {Packet} pack A PN532 Frame Packet.
     * @returns {Pn532FrameNormal|Pn532FrameExtended} A `Pn532Frame` initialized from `pack`
     */
    static create (pack) {
      if (!Packet.isLen(pack)) throw new TypeError('invalid pack type')
      if (pack.length === 6) return new Pn532FrameAck(pack)
      return pack.getUint16(3) === 0xFFFF ? new Pn532FrameExtended(pack) : new Pn532FrameNormal(pack)
    }

    /**
     * Find `offset` and `length` of a PN532 Frame in `buf`
     * @package
     * @param {Packet} buf A buffer
     * @returns {number[]} `[offset, length]` of a PN532 Frame in `buf`. returns `[offset, 0]` if PN532 Frame not found in `buf`.
     */
    static bufFindOffsetLen (buf) {
      // 找 PREAMBLE
      const offset = buf.indexOf(0, 0, 0xFF);
      if (offset === -1) return [-1, 0] // PREAMBLE not found
      buf = buf.subarray(offset); // remove data before offset

      if (buf.length >= 6 && buf[5] === 0) { // could be ACK or NACK
        const u16 = buf.getUint16(3);
        if (u16 === 0xFF00 || u16 === 0x00FF) return [offset, 6] // ACK or NACK
      }

      const mod256 = num => num & 0xFF;
      let len = 0;
      // Normal frame
      if (buf.length >= 8 && !mod256(buf[3] + buf[4])) len = buf[3] + 7;
      // Extended frame
      if (buf.length >= 11 && buf.getUint16(3) === 0xFFFF && !mod256(buf[5] + buf[6] + buf[7])) len = buf.getUint16(5, false) + 10;

      return [offset, buf.length >= len ? len : 0] // need more data
    }

    /**
     * Get `cmd` of this PN532 Frame
     * @abstract
     * @member {number}
     */
    get cmd () { throw new Error('not implement') }

    /**
     * Indicating whether or not this Frame is PN532 ACK Frame.
     * @abstract
     * @member {boolean}
     */
    get isAck () { throw new Error('not implement') }

    /**
     * Get `tfi` of this PN532 Frame
     * @abstract
     * @member {number}
     */
    get tfi () { return 0 }

    /**
     * Get format error in frame data.
     * @abstract
     * @returns {?Error} Returns `Error` if a format error found in frame data. Otherwise returns `null`.
     */
    getFrameErr () { throw new Error('not implement') }

    /**
     * Get application error in frame data.
     * @abstract
     * @returns {?Error} Returns `Error` if an application error found in frame data. Otherwise returns `null`.
     */
    getAppErr () {
      if (_.includes([0xD4, 0xD5], this.tfi)) return null
      return new Error(PN532_ERROR[this.tfi] ?? `unknown error code: ${this.tfi}`)
    }
  }

  /**
   * Class of PN532 ACK/NACK Frame
   * @class
   * @param {Packet} pack A PN532 Frame Data.
   */
  class Pn532FrameAck extends Pn532Frame {
    getFrameErr () {
      try {
        const { pack } = this;
        if (pack.length !== 6 || !_.includes([0x00FF, 0xFF00], pack.getUint16(3))) throw new TypeError('invalid ack/nack')
        return null
      } catch (err) {
        return err.message
      }
    }

    get isAck () { return this.pack.getUint16(3) === 0xFF00 }
  }

  /**
   * Class of PN532 Normal Frame
   * @implements {Pn532Frame}
   */
  class Pn532FrameNormal extends Pn532Frame {
    constructor (pack) {
      super(pack);
      this.data = pack.subarray(7, pack.length - 2);
    }

    getFrameErr () {
      try {
        const { pack } = this;
        if (pack.length < 8 || pack.length !== pack[3] + 7) throw new TypeError('invalid pack length')
        if ((pack[3] + pack[4]) & 0xFF) throw new TypeError('invalid len and lcs')
        if (_.sumBy(pack.subarray(5, pack.length - 1)) & 0xFF) throw new TypeError('invalid dcs')
        return null
      } catch (err) {
        return err.message
      }
    }

    get cmd () { return this.pack[6] }
    get tfi () { return this.pack[5] }
  }

  /**
   * Class of PN532 Extended Frame
   * @implements {Pn532Frame}
   */
  class Pn532FrameExtended extends Pn532Frame {
    constructor (pack) {
      super(pack);
      this.data = pack.subarray(10, pack.length - 2);
    }

    getFrameErr () {
      try {
        const { pack } = this;
        if (pack.length < 11 || pack.length !== pack.getUint16(5, false) + 10) throw new TypeError('invalid pack length')
        if (pack.getUint16(3) !== 0xFFFF || ((pack[5] + pack[6] + pack[7]) & 0xFF)) throw new TypeError('invalid len and lcs')
        if (_.sumBy(pack.subarray(8, pack.length - 1)) & 0xFF) throw new TypeError('invalid dcs')
        return null
      } catch (err) {
        return err.message
      }
    }

    get cmd () { return this.pack[9] }
    get tfi () { return this.pack[8] }
  }

  /**
   * The Core library of PN532. A Pn532 instance must register exactly one adapter plugin to communication to PN532 hardware.
   * @example
   * // setup
   * const {
   *   _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
   *   Pn532: { Pn532, Packet, utils: Pn532utils },
   *   Crypto1,
   *   Pn532Hf14a,
   *   Pn532WebbleAdapter,
   *   Pn532WebserialAdapter,
   * } = window
   *
   * const pn532usb = new Pn532()
   * pn532usb.use(new Pn532WebserialAdapter())
   */
  class Pn532 {
    constructor () {
      // https://web.dev/serial/#transforming-streams

      /**
       * Internal parameters of the PN532 to configure its behavior regarding different cases.
       * @package
       * @member {number}
       */
      this.parameters = 0;

      /**
       * Stores registered middlewares to be compose. Middleware is similar to hooks. `middleware` will be compose and execute in order at specific `key` hook.
       * @package
       * @member {object}
       * @see https://github.com/koajs/compose
       */
      this.middlewares = {};

      /**
       * Stores registered plugins
       * @package
       * @member {Map}
       */
      this.plugins = new Map();

      /**
       * Buffer of unhandled response
       * @member {PN532Frame[]}
       */
      this.respBuf = [];

      /**
       * Buffer of unhandled response bytes
       * @member {Packet}
       */
      this.rxBuf = new Packet();

      /**
       * A `TransformStream` to send frame to Adapter
       * @member {TransformStream}
       */
      this.tx = null;

      /**
       * A `TransformStream` to read frame from Adapter
       * @member {TransformStream}
       */
      this.rx = new TransformStream({
        transform: (pack, controller) => {
          this.rxBuf = Packet.merge(this.rxBuf, pack);

          do {
            const [offset, len] = Pn532Frame.bufFindOffsetLen(this.rxBuf);
            if (len < 1) return
            controller.enqueue(Pn532Frame.create(this.rxBuf.slice(offset, offset + len)));
            this.rxBuf = this.rxBuf.slice(offset + len);
          } while (true)
        },
      });

      this.rx.readable.pipeTo(new WritableStream({ // no wait
        write: pack => { this.respBuf.push(pack); },
      }));
    }

    /**
     * install a plugin instance to this PN532 instance.
     * @param {object} plugin A plugin instance to install
     * @param {object} option option passthrough to `plugin#install`
     * @returns {this} `this`
     * @see https://developers.line.biz/en/docs/liff/liff-plugin/
     * @example
     * // setup
     * const {
     *   _, // lodash: https://cdn.jsdelivr.net/npm/lodash@4/lodash.min.js
     *   Pn532: { Pn532, Packet, utils: Pn532utils },
     *   Crypto1,
     *   Pn532Hf14a,
     *   Pn532WebbleAdapter,
     *   Pn532WebserialAdapter,
     * } = window
     *
     * const pn532usb = new Pn532()
     * pn532usb.use(new Pn532WebserialAdapter())
     */
    async use (plugin, option = {}) {
      if (!plugin || !_.isFunction(plugin.install) || !_.isString(plugin.name)) throw new TypeError('property plugin.name and method plugin.install is required.')
      const pluginId = `$${plugin.name}`;
      if (this.hasPlugin(pluginId)) return this
      const installed = await plugin.install({
        Packet,
        pn532: this,
        utils,
      }, option);
      if (!_.isNil(installed)) this[pluginId] = installed;
      this.addPlugin(pluginId, plugin);
      return this
    }

    addPlugin (pluginId, plugin) {
      this.plugins.set(pluginId, plugin);
    }

    /**
     * Determines whether `pluginId` has been installed.
     * @param {string} pluginId plugin identifier
     * @returns {boolean} Indicating whether or not the `pluginId` has been installed.
     */
    hasPlugin (pluginId) {
      return this.plugins.has(pluginId)
    }

    /**
     * Middleware is similar to hooks. `middleware` will be compose and execute in order at specific `key` hook.
     * @param {string} key which key to be add
     * @param {*} middleware middleware function with format `async (ctx, next) => {}`
     * @see https://github.com/koajs/compose
     */
    addMiddleware (key, middleware) {
      if (!_.isString(key) || !key.length) throw new TypeError('key is required')
      if (!_.isFunction(middleware)) throw new TypeError('middleware is required')

      if (!_.isArray(this.middlewares[key])) this.middlewares[key] = [];
      this.middlewares[key].push(middleware);
    }

    /**
     * Write Packet to Adapter
     * @async
     * @param {*} pack A pack to be write to adapter
     * @returns {Promise<null>} Resolve after finish.
     */
    async writePacket (pack) {
      const handler = middlewareCompose([
        ...(this.middlewares.writePacket ?? []),
        async (ctx, next) => {
          if (!Packet.isLen(ctx.pack)) throw new TypeError('pack should be Packet')
          ctx.writer = this.tx?.writable?.getWriter?.();
          if (!ctx.writer) throw new Error('Failed to getWriter(). Did you remember to use adapter plugin?')
          await ctx.writer.write(ctx.pack);
          ctx.writer.releaseLock();
        },
      ]);
      return await handler({ pack })
    }

    /**
     * Send a command to adapter via PN532 noraml frame.
     * @async
     * @param {object} args
     * @param {number} args.cmd PN532 command
     * @param {Packet} args.data PN532 command data. Max size is 253 bytes.
     * @returns {Promise<null>} Resolve after finish.
     */
    async sendCommandNormal ({ cmd, data = new Packet() }) {
      if (!Packet.isLen(data)) throw new TypeError('data should be Packet')
      if (data.byteLength > 253) throw new TypeError('data.byteLength > 253') // TFI + CMD + Data (253 bytes)
      const pack = new Packet(data.byteLength + 9); // PREAMBLE (3 bytes) + LEN + LCS + TFI + CMD + Data (253 bytes) + DCS + POSTAMBLE
      const len = data.byteLength + 2;
      pack.set(new Packet([0xFF, len, -len, 0xD4, cmd]), 2);
      if (data.byteLength) pack.set(data, 7);
      const dcs = pack.byteLength - 2;
      pack[dcs] = 0;
      for (const b of pack.subarray(5, dcs)) pack[dcs] -= b;
      await this.writePacket(pack);
    }

    /**
     * Send a command to adapter via PN532 extended frame.
     * @async
     * @param {object} args
     * @param {number} args.cmd PN532 command
     * @param {Packet} args.data PN532 command data. Max size is 65533 bytes.
     * @returns {Promise<null>} Resolve after finish.
     */
    async sendCommandExtended ({ cmd, data = new Packet() }) {
      if (!Packet.isLen(data)) throw new TypeError('data should be Packet')
      if (data.byteLength > 65533) throw new TypeError('data.byteLength > 65533') // TFI + CMD + Data (65533 bytes)
      const pack = new Packet(data.byteLength + 12); // PREAMBLE (5 bytes) + LEN (2 bytes) + LCS + TFI + CMD + Data (65533 bytes) + DCS + POSTAMBLE
      const len = data.byteLength + 2;
      const [lenM, lenL] = [len >>> 8, len & 0xFF];
      pack.set(new Packet([0xFF, 0xFF, 0xFF, lenM, lenL, -(lenM + lenL), 0xD4]), 2);
      if (data.byteLength) pack.set(data, 10);
      const dcs = pack.byteLength - 2;
      pack[dcs] = 0;
      for (const b of pack.subarray(8, dcs)) pack[dcs] -= b;
      await this.writePacket(pack);
    }

    /**
     * Send a Wakeup Command.
     * @async
     * @returns {Promise<null>} Resolve after finish.
     */
    async sendCommandWakeup () {
      await this.writePacket(Packet.fromHex('55550000000000000000000000000000FF05FBD4140114010200'));
      await this.readRespTimeout({ cmd: 0x15 });
    }

    /**
     * Reset parameters and internal registers of PN532 to default value.
     * @async
     * @returns {Promise<null>} Resolve after finish.
     * @see {@link https://www.nxp.com/docs/en/nxp/data-sheets/PN532_C1.pdf|PN532/C1 P.189}
     */
    async resetSettings () {
      await this.setParameters(0x14); // PARAM_AUTO_ATR_RES = 0x04, PARAM_AUTO_RATS = 0x10
      await this.updateRegistersWithMask([
        { adr: 0x6302, mask: 0x80, value: 0x80 }, // PN53X_REG_CIU_TxMode, SYMBOL_TX_CRC_ENABLE, 0x80
        { adr: 0x6303, mask: 0x80, value: 0x80 }, // PN53X_REG_CIU_RxMode, SYMBOL_RX_CRC_ENABLE, 0x80
        { adr: 0x630D, mask: 0x10, value: 0x00 }, // PN53X_REG_CIU_ManualRCV, SYMBOL_PARITY_DISABLE, 0x00
        { adr: 0x6338, mask: 0x08, value: 0x00 }, // PN53X_REG_CIU_Status2, SYMBOL_MF_CRYPTO1_ON, 0x00
        { adr: 0x633D, mask: 0x07, value: 0x00 }, // PN53X_REG_CIU_BitFraming, SYMBOL_TX_LAST_BITS, 0x00
      ]);
    }

    /**
     * Clear the buffer of unhandled response.
     */
    clearRespBuf () {
      this.respBuf.splice(0, this.respBuf.length);
    }

    /**
     * Read any response or specific response from adapter.
     * @async
     * @param {object} args
     * @param {number} args.cmd Expected cmd of response. Response will be skipped when `cmd` is not `null` and cmd of response is not equals to `cmd`.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @param {function} args.respValidator Custom validator of resp.
     * @returns {Promise<Pn532Frame>} Resolve with raw response need to be parsed.
     */
    async readRespTimeout ({ cmd = null, timeout = 5e3, respValidator = null }) {
      const skipRespLogger = middlewareCompose([
        ...(this.middlewares.skipRespLogger ?? []),
      ]);
      const handler = middlewareCompose([
        ...(this.middlewares.readRespTimeout ?? []),
        async (ctx, next) => {
          ctx.startedAt = Date.now();
          while (true) {
            if (!this?.$adapter?.isOpen?.()) throw new Error('device disconnected')
            ctx.nowts = Date.now();
            if (ctx.nowts > ctx.startedAt + ctx.timeout) throw new Error(`readRespTimeout ${ctx.timeout}ms`)
            while (this.respBuf.length) {
              const resp = this.respBuf.shift();
              if (resp.getFrameErr()) {
                await skipRespLogger({ message: 'invalid pn532 frame', resp });
                continue
              }
              if (resp instanceof Pn532FrameAck) { // check ack/nack
                if (!resp.isAck) throw new Error('receive nack')
                await skipRespLogger({ message: 'pn532 ack frame', resp });
                continue
              }
              if (!_.isNil(ctx.cmd) && resp.cmd !== ctx.cmd) {
                await skipRespLogger({ message: 'unexpected resp.cmd', resp });
                continue
              }
              if (_.isFunction(respValidator) && !respValidator(resp)) {
                await skipRespLogger({ message: 'respValidator return falsy', resp });
                continue
              }
              return resp
            }
            await sleep(10);
          }
        },
      ]);
      return await handler({ cmd, timeout })
    }

    /**
     * This command is designed for self-diagnosis.
     * @async
     * @param {object} args
     * @param {number} args.test Test number to be executed by the PN532 (1 byte),
     * @param {Packet} args.data diagnosis command data.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Pn532Frame>} Resolve with raw response (contains from 1 to 262 bytes data) need to be parsed.
     */
    async diagnose ({ test = 0x00, data = new Packet(), timeout } = {}) {
      if (!Packet.isLen(data)) throw new TypeError('data should be Packet')
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x00, data: new Packet([test, ...data]) });
      const resp = await this.readRespTimeout({ cmd: 0x01, timeout });
      const statusErr = hasPn532StatusError(resp.data[0]);
      if (statusErr) throw statusErr
      resp.data = resp.data.subarray(1);
      return resp
    }

    /**
     * This test is for communication test between host controller and the PN532. "Parameter Length" and "Parameters" in response packet are same as "Parameter Length" and "Parameter" in command packet.
     * @async
     * @param {string} utf8 A utf8 string to test
     * @returns {Promise<boolean>} Resolve with test result.
     */
    async testCommunication (utf8 = 'ping') {
      const { data: resData } = await this.diagnose({ test: 0x00, data: Packet.fromUtf8(utf8) });
      return resData.utf8 === utf8
    }

    /**
     * This test is for checking ROM data by 8 bits checksum.
     * @async
     * @returns {Promise<boolean>} Resolve with test result.
     */
    async testRom () {
      const { status } = await this.diagnose({ test: 0x01 });
      return status === 0x00 // 0x00: OK, 0xFF: Not Good
    }

    /**
     * This test is for checking RAM; 768 bytes of XRAM and 128 bytes of IDATA. The test method used consists of saving original content, writing test data, checking test data and finally restore original data. So, this test is non destructive.
     * @async
     * @returns {Promise<boolean>} Resolve with test result.
     */
    async testRam () {
      const { status } = await this.diagnose({ test: 0x02 });
      return status === 0x00 // 0x00: OK, 0xFF: Not Good
    }

    /**
     * This test is for checking the percentage of failure regarding response packet receiving after polling command transmission. In this test, the PN532 sends a FeliCa polling command packet 128 times to target. The PN532 counts the number of fails and returns the failed number to host controller. This test doesn’t require specific system code for target.
     *
     * Polling is done with system code (0xFF, 0xFF). The baud rate used is either 212 kbps or 424 kbps.
     *
     * One polling is considered as defective after no correct polling response within 4 ms. During this test, the analog settings used are those defined in command RFConfiguration within the item n°7 (§7.3.1, p: 101).
     * @async
     * @param {integer} baudrate 0x01: 212 kbps, 0x02: 424 kbps
     * @returns {Promise<number>} Resolve with Number of fails (Maximum 128).
     */
    async testTargetPolling (baudrate = 0x01) {
      const { status } = await this.diagnose({ test: 0x04, data: new Packet([baudrate]) });
      return status
    }

    /**
     * This test can be used by an initiator to ensure that a target/card is still in the field:
     *
     * * In case of DEP target, an Attention Request command is sent to the target, and it is expected to receive the same answer from the target. In that case, the test is declared as successful;
     * * In case of ISO/IEC14443-4 card, a R(NACK) block is sent to the card and it is expected to receive either a R(ACK) block or the last I-Block. In that case, the test is declared as successful (ISO/IEC14443-4 card is still in the RF field).
     * @async
     * @returns {Promise<boolean>} Resolve with a boolean indicating whether or not the target is present.
     */
    async testTargetPresent () {
      const { status } = await this.diagnose({ test: 0x06 });
      return status
    }

    /**
     * This test is used to check the continuity of the transmission paths of the antenna.
     * @async
     * @returns {Promise<number>} Resolve with test result. 0x00: OK, others: Not OK (no antenna is detected)
     */
    async testSelfAntenna () {
      const { status } = await this.diagnose({ test: 0x07 });
      return status
    }

    /**
     * The PN532 sends back the version of the embedded firmware.
     * @async
     * @returns {Promise<object>} Resolve with object `res`:
     * - `res.firmware` ({@link string}): Version and revision of the firmware.
     * - `res.ic` ({@link string}): Version of the IC. For PN532, the value is `PN532`.
     * - `res.iso14443a` ({@link boolean}): Indicating whether or not support ISO/IEC 14443 TypeA
     * - `res.iso14443b` ({@link boolean}): Indicating whether or not support ISO/IEC 14443 TypeB
     * - `res.iso18092` ({@link boolean}): Indicating whether or not support ISO18092
     */
    async getFirmwareVersion () {
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x02 });
      const { data } = await this.readRespTimeout({ cmd: 0x03 });
      return {
        firmware: `${data[1]}.${data[2]}`,
        ic: `PN5${data.subarray(0, 1).hex}`,
        iso14443a: (data[3] & 0b1) > 0,
        iso14443b: (data[3] & 0b10) > 0,
        iso18092: (data[3] & 0b100) > 0,
      }
    }

    /**
     * This command is used to read the content of one or several internal registers of the PN532 (located either in the SFR area or in the XRAM memory space).
     * @async
     * @param {number[]} adrs One or several internal registers of the PN532 to read. The High Byte of the address of the SFR registers should be set to `0xFF`.
     * @returns {Promise<object>} Resolve with an object which key is register address and value is register value.
     */
    async readRegisters (adrs = []) {
      if (!_.isArray(adrs) || !adrs.length) throw new TypeError('invalid adrs')
      const reqData = new Packet(adrs.length * 2);
      for (let i = 0; i < adrs.length; i++) reqData.setUint16(i * 2, adrs[i], false);
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x06, data: reqData });
      const { data: resData } = await this.readRespTimeout({ cmd: 0x07 });
      return _.zipObject(adrs, resData)
    }

    /**
     * This command is used to overwrite the content of one or several internal registers of the PN532 (located either in the SFR area or in the XRAM memory space).
     * @async
     * @param {object} regs key is register address and value is register value.
     * @returns {Promise<null>} Resolve after finish.
     */
    async writeRegisters (regs) {
      if (_.isPlainObject(regs)) regs = _.toPairs(regs);
      if (!_.isArray(regs) || !regs.length) throw new TypeError('invalid regs')
      const reqData = new Packet(regs.length * 3);
      for (let i = 0; i < regs.length; i++) {
        reqData.setUint16(i * 3, _.parseInt(regs?.[i]?.[0] ?? 0), false);
        reqData[i * 3 + 2] = _.parseInt(regs?.[i]?.[1] ?? 0);
      }
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x08, data: reqData });
      await this.readRespTimeout({ cmd: 0x09 });
    }

    /**
     * This command is used to update the masked value of several internal registers of the PN532 (located either in the SFR area or in the XRAM memory space).
     * @async
     * @param {{ adr: number, mask: number, value: number }[]} rows An array of register address and masked value to be update.
     * @returns {Promise<null>} Resolve after finish.
     * @see {@link https://www.nxp.com/docs/en/nxp/data-sheets/PN532_C1.pdf|PN532/C1 P.189}
     */
    async updateRegistersWithMask (rows = []) {
      if (!_.isArray(rows)) throw new TypeError('invalid rows')
      rows = _.filter(rows, row => _.has(row, 'adr') && _.has(row, 'mask') && _.has(row, 'value'));
      if (!rows.length) throw new TypeError('invalid rows.length')
      const adrs = _.uniq(_.map(rows, 'adr'));
      const regs = await this.readRegisters(adrs);
      for (const row of rows) {
        regs[row.adr] = (regs[row.adr] & (row.mask ^ 0xFF)) | (row.value & row.mask);
      }
      await this.writeRegisters(regs);
    }

    /**
     * @typedef {object} Pn532~Gpio
     * @property {number} p32 Representing the pin P32_INT0. P32 can be used as standard GPIO and is therefore not used as external interrupt trigger. Nevertheless, for the PowerDown command (§7.2.11, p:98), this pin can be used for the waking up. Moreover, when configured to use the handshake mechanism (§6.3, p:48), this pin may be used for the H_REQ line.
     * @property {number} p33 Representing the pin P33_INT1. P33 can be used as standard GPIO and is therefore not used as external interrupt trigger. Nevertheless, for the PowerDown command (§7.2.11, p:98), this pin can be used for the waking up.
     * @property {number} p34 Representing the pin P34/SIC_CLK. When configured to use the SAM companion chip (see `SAMConfiguration` command (§7.2.10 p:89)), P34 is used for the CLAD line.
     * @property {number} p71 Representing the pins MISO/P71 of the SPI bus. P71 and P72 can be used as GPIO when the PN532 is not configured to use the SPI interface to communicate with the host controller.
     * @property {number} p72 Representing the pin SCK/P72 of the SPI bus. P71 and P72 can be used as GPIO when the PN532 is not configured to use the SPI interface to communicate with the host controller.
     * @property {number} i0 I0 and I1 (see § 6.1.1, p:24) are used to select the host controller interface. Once the selection has been done by the firmware, these two pins can be used as GPIOs.
     * @property {number} i1 I0 and I1 (see § 6.1.1, p:24) are used to select the host controller interface. Once the selection has been done by the firmware, these two pins can be used as GPIOs.
     */

    /**
     * The PN532 reads the value for each port and returns the information to the host controller.
     * @async
     * @returns {Promise<Pn532~Gpio>} See {@link Pn532~Gpio} for more description.
     */
    async readGpio () {
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x0C });
      const { data: resData } = await this.readRespTimeout({ cmd: 0x0D });
      return _.fromPairs([
        ..._.times(6, i => [`p3${i}`, (resData[0] >>> i) & 1]),
        ..._.times(2, i => [`p7${i + 1}`, (resData[1] >>> (i + 1)) & 1]),
        ..._.times(2, i => [`i${i}`, (resData[2] >>> i) & 1]),
      ])
    }

    /**
     * The PN532 applies the value for each port that is validated by the host controller.
     * @async
     * @param {Pn532~Gpio} gpio See {@link Pn532~Gpio} for more description.
     * @returns {Promise<null>} Resolve after finish.
     */
    async writeGpio (gpio = {}) {
      const reqData = new Packet([0x00, 0x00]);
      for (let i = 0; i < 6; i++) {
        if (!_.has(gpio[`p3${i}`])) continue
        reqData[0] |= (gpio[`p3${i}`] ? (1 << i) : 0) | 0x80;
      }
      for (let i = 1; i < 3; i++) {
        if (!_.has(gpio[`p7${i}`])) continue
        reqData[1] |= (gpio[`p7${i}`] ? (1 << i) : 0) | 0x80;
      }
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x0E, data: reqData });
      await this.readRespTimeout({ cmd: 0x0F });
    }

    /**
     * This command is used to set internal parameters of the PN532, and then to configure its behavior regarding different cases.
     * @async
     * @param {number} flags A 8-bit unsigned integer indicates new internal parameters of PN532. `flags` is a bit-field byte which individual definition is the following:
     *
     * | Bit | Value | Name | Definition |
     * | --- | ----- | ---- | ---------- |
     * | 0 | 0x01 | PARAM_NAD_USED | Use of the NAD information in case of initiator configuration (DEP and ISO/IEC14443-4 PCD). |
     * | 1 | 0x02 | PARAM_DID_USED | Use of the DID information in case of initiator configuration (or CID in case of ISO/IEC14443-4 PCD configuration). |
     * | 2 | 0x04 | PARAM_AUTO_ATR_RES | Automatic generation of the ATR_RES in case of target configuration. |
     * | 3 | 0x08 | RFU | **Must** be set to 0. |
     * | 4 | 0x10 | PARAM_AUTO_RATS | Automatic generation of the RATS in case of ISO/IEC14443-4 PCD mode. |
     * | 5 | 0x20 | PARAM_14443_4_PICC | The emulation of a ISO/IEC14443-4 PICC is enabled. |
     * | 6 | 0x40 | PARAM_NO_AMBLE | The PN532 does not send Preamble and Postamble. |
     * | 7 | 0x80 | RFU | **Must** be set to 0. |
     * @returns {Promise<null>} Resolve after finish.
     * @see {@link https://www.nxp.com/docs/en/user-guide/141520.pdf|PN532 User Manual P.85}
     */
    async setParameters (flags) {
      this.clearRespBuf();
      flags &= 0xFF;
      await this.sendCommandNormal({ cmd: 0x12, data: new Packet([flags]) });
      await this.readRespTimeout({ cmd: 0x13 });
      this.parameters = flags;
    }

    /**
     * This command is used to select the data flow path by configuring the internal serial data switch.
     * @async
     * @param {object} args
     * @param {number} args.mode defines the way of using the SAM (Security Access Module):
     * - `0x01`: **Normal mode**, the SAM is not used; this is the default mode
     * - `0x02`: **Virtual Card**, the couple PN532+SAM is seen as only one contactless SAM card from the external world
     * - `0x03`: **Wired Card**, the host controller can access to the SAM with standard PCD commands (`InListPassiveTarget`, `InDataExchange`, ...)
     * - `0x04`: **Dual Card**, both the PN532 and the SAM are visible from the external world as two separated targets.
     *
     * Virtual, Wired and Dual Card mode are only valid with 106kbps ISO14443-3 and 4 type A and Mifare.
     * @param {number} args.timeout Defines the timeout only in Virtual card configuration (Mode = `0x02`). In Virtual Card mode, this field is required; whereas in the other mode, it is optional. This parameter indicates the timeout value with a LSB of 50ms. There is no timeout control if the value is `null` (Timeout = 0). The maximum value for the timeout is 12.75 sec (Timeout = `0xFF`).
     * @param {number} args.irq Specifies if the PN532 takes care of the `P70_IRQ` pin or not.
     * - `0x00`: the `P70_IRQ` pin remains at high level
     * - `0x01`: the `P70_IRQ` pin is driven by the PN532.
     * - `null`: The default value is `0x01`.
     * @returns {Promise<null>} Resolve after finish.
     */
    async samConfiguration ({ mode = 1, timeout = 0x14, irq = null } = {}) {
      this.clearRespBuf();
      if (!_.isNil(irq)) irq = irq ? 1 : 0;
      await this.sendCommandNormal({ cmd: 0x14, data: new Packet([mode, timeout, ...(_.isNil(irq) ? [] : [irq])]) });
      await this.readRespTimeout({ cmd: 0x15 });
    }

    /**
     * This command is used to configure the different settings of the PN532 as described in the input section of this command.
     * @async
     * @param {object} args
     * @param {number} args.item Item of the configuration.
     * @param {Packet} args.data Data of the configuration.
     * @returns {Promise<null>} Resolve after finish.
     */
    async rfConfiguration ({ item, data = new Packet() } = {}) {
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x32, data: new Packet([item, ...data]) });
      await this.readRespTimeout({ cmd: 0x33 });
    }

    /**
     * Switching on or off the RF field immediately.
     *
     * When the bit AutoRFCA is off, the PN532 does not need to take care of external field before switching on its own field. In other words, if the bit AutoRFCA is off and RFon/off is on, the PN532 will generate RF field whatever external field is (present or not).
     * @async
     * @param {object} args
     * @param {boolean} args.autoRfca
     * @param {boolean} args.rfOnOff
     * @returns {Promise<null>} Resolve after finish.
     */
    async rfSetField ({ autoRfca = 1, rfOnOff = 0 } = {}) {
      const reqData = new Packet(1);
      if (autoRfca) reqData[0] |= 0b10;
      if (rfOnOff) reqData[0] |= 0b1;
      await this.rfConfiguration({ item: 0x01, data: reqData });
    }

    /**
     * Set timeouts of PN532.
     * | Byte Value | Timeout Value |
     * | ---------: | ------------: |
     * |       0x00 |    no timeout |
     * |       0x01 |        100 μs |
     * |       0x02 |        200 μs |
     * |       0x03 |        400 μs |
     * |       0x04 |        800 μs |
     * |       0x05 |        1.6 ms |
     * |       0x06 |        3.2 ms |
     * |       0x07 |        6.4 ms |
     * |       0x08 |       12.8 ms |
     * |       0x09 |       25.6 ms |
     * |       0x0A |       51.2 ms |
     * |       0x0B |      102.4 ms |
     * |       0x0C |      204.8 ms |
     * |       0x0D |      409.6 ms |
     * |       0x0E |      819.2 ms |
     * |       0x0F |      1.64 sec |
     * |       0x0A |      3.28 sec |
     * @async
     * @param {object} args
     * @param {number} args.atrres defines the timeout between `ATR_REQ` and `ATR_RES`
     * @param {number} args.retry defines the timeout value that the PN532 uses in the `InCommunicateThru` and `InDataExchange`
     * @returns {Promise<null>} Resolve after finish.
     */
    async rfSetTimeouts ({ atrres = 0x0B, retry = 0x0A } = {}) {
      if (!_.inRange(atrres, 0, 0x11)) throw new TypeError('invalid atrres timeouts')
      if (!_.inRange(retry, 0, 0x11)) throw new TypeError('invalid retry timeouts')
      await this.rfConfiguration({ item: 0x02, data: new Packet([0, atrres, retry]) });
    }

    /**
     * Define the number of retries that the PN532 will use in case of the following processes.
     * @async
     * @param {object} args
     * @param {object} args.atr A byte containing the number of times that the PN532 will retry to send the `ATR_REQ` in case of incorrect reception of the `ATR_RES` (or no reception at all - timeout).
     * - For **active mode**, value `0xFF` means to try eternally, `0x00` means only once (no retry, only one try). The default value of this parameter is `0xFF` (infinitely).
     * - For **passive mode**, the value is always overruled with `0x02` (two retries).
     * @param {object} args.psl A byte containing the number of times. Value `0xFF` means to try eternally, `0x00` means only once (no retry, only one try). The default value of this parameter is `0x01` (the `PSL_REQ/PPS` request is sent twice in case of need).
     * - The PN532 will retry to send the `PSL_REQ` in case of incorrect reception of the `PSL_RES` (or no reception at all) for the NFC IP1 protocol
     * - The PN532 will retry to send the `PPS` request in case of incorrect reception of the PPS response (or no reception at all) for the ISO/IEC14443-4
  protocol.
     * @param {object} args.passiveActivation A byte containing the number of times that the PN532 will retry to activate a target in `InListPassiveTarget` command (§7.3.5, p: 115). Value `0xFF` means to try eternally, `0x00` means only once (no retry, only one try). The default value of this parameter is `0xFF` (infinitely).
     * @returns {Promise<null>} Resolve after finish.
     */
    async rfSetMaxRetries ({ atr = 0xFF, psl = 0x01, passiveActivation = 0xFF } = {}) {
      await this.rfConfiguration({ item: 0x05, data: new Packet([atr, psl, passiveActivation]) });
    }

    /**
     * This command is used to detect as many targets (maximum `MaxTg`) as possible in passive mode.
     * @async
     * @param {object} args
     * @param {number} args.maxTg The maximum number of targets to be initialized by the PN532. The PN532 is capable of handling 2 targets maximum at once, so this field should not exceed `0x02`. For Jewel card, only one target can be initialized.
     * @param {number} args.brTy The baud rate and the modulation type to be used during the initialization.
     * - `0x00`: 106 kbps type A (ISO/IEC14443 Type A)
     * - `0x01`: 212 kbps (FeliCa polling)
     * - `0x02`: 424 kbps (FeliCa polling)
     * - `0x03`: 106 kbps type B (ISO/IEC14443-3B)
     * - `0x04`: 106 kbps Innovision Jewel tag
     * @param {Packet} args.data InitiatorData to be used during the initialization of the target(s). Depending on the Baud Rate specified, the content of this field is different:
     * - **106 kbps type A**: The field is optional and is present only when the host controller wants to initialize a target with a known UID. In that case, InitiatorData contains the UID of the card (or part of it). The UID must include the cascade tag CT if it is cascaded level 2 or 3.
     *
     * ![](https://i.imgur.com/FiwC9Gt.png)
     * - **106 kbps type B**: data is consisted as following:
     *   - AFI (1 byte): This field is required. The AFI (Application Family Identifier) parameter represents the type of application targeted by the PN532 and is used to pre-select the PICCs before the ATQB.
     *   - Polling Method: This field is optional. It indicates the approach to be used in the ISO/IEC14443- 3B initialization:
     *     - If bit 0 = 1: Probabilistic approach (option 1) in the ISO/IEC14443-3B initialization
     *     - If bit 0 = 0: Timeslot approach (option 2) in the ISO/IEC14443-3B initialization
     *     - If this field is absent, the timeslot approach will be used.
     * - **212/424 kbps**: In that case, this field is required and contains the complete payload information that should be used in the polling request command (5 bytes, length byte is excluded) as defined in Error! Reference source not found. §11.2.2.5.
     * - **106 kbps Innovision Jewel tag**: This field is not used.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Pn532Frame>} Resolve with raw response need to be parsed.
     * @see {@link https://www.nxp.com/docs/en/user-guide/141520.pdf|PN532 User Manual P.116}
     */
    async inListPassiveTarget ({ maxTg = 1, brTy = 0, data = new Packet(), timeout = 3e4 } = {}) {
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x4A, data: new Packet([maxTg, brTy, ...data]) });
      return await this.readRespTimeout({ cmd: 0x4B, timeout })
    }

    /**
     * This command is used to support protocol data exchanges between the PN532 as initiator and a target.
     * @async
     * @param {object} args
     * @param {number} args.tg A byte containing the logical number of the relevant target. This byte contains also a More Information (MI) bit (bit 6) indicating, when set to 1, that the host controller wants to send more data that all the data contained in the DataOut array (see Chaining mechanism §7.4.5, p: 178). This bit is only valid for a TPE target.
     * @param {Packet} args.data An array of raw data to be sent to the target by the PN532 (max. 263 bytes, see §7.4.7, p:186).
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @param {function} args.respValidator Custom validator of resp.
     * @returns {Promise<Pn532Frame>} Resolve with raw response need to be parsed.
     * @see {@link https://www.nxp.com/docs/en/user-guide/141520.pdf|PN532 User Manual P.127}
     */
    async inDataExchange ({ tg = 1, data = new Packet(), timeout, respValidator } = {}) {
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x40, data: new Packet([tg, ...data]) });
      const resp = await this.readRespTimeout({ cmd: 0x41, timeout, respValidator });
      const statusErr = hasPn532StatusError(resp.data[0]);
      if (statusErr) throw statusErr
      resp.data = resp.data.subarray(1);
      return resp
    }

    /**
     * This command is used to support basic data exchanges between the PN532 and a target.
     * @async
     * @param {object} args
     * @param {Packet} args.data An array of raw data to be sent to the target by the PN532 (max. 264 bytes, see §7.4.7, p:186).
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @param {function} args.respValidator Custom validator of resp.
     * @returns {Promise<Pn532Frame>} Resolve with raw response need to be parsed.
     */
    async inCommunicateThru ({ data = new Packet(), timeout, respValidator } = {}) {
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x42, data });
      const resp = await this.readRespTimeout({ cmd: 0x43, timeout, respValidator });
      const statusErr = hasPn532StatusError(resp.data[0]);
      if (statusErr) throw statusErr
      resp.data = resp.data.subarray(1);
      return resp
    }

    /**
     * This command is used to deselect the target(s) Tg. The PN532 keeps all the information relative to this target.
     * @async
     * @param {object} args
     * @param {number} args.tg A byte containing the logical number of the relevant target (0x00 is a specific value indicating all targets).
     * @returns {Promise<null>} Resolve after finish.
     */
    async inDeselect ({ tg = 0 } = {}) {
      if (_.isNil(tg)) throw new TypeError('invalid tg')
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x44, data: new Packet([tg]) });
      const resp = await this.readRespTimeout({ cmd: 0x45 });
      const statusErr = hasPn532StatusError(resp.data[0]);
      if (statusErr) throw statusErr
      resp.data = resp.data.subarray(1);
      return resp
    }

    /**
     * This command is used to release the target(s) Tg.
     * @async
     * @param {object} args
     * @param {number} args.tg A byte containing the logical number of the relevant target (0x00 is a specific value indicating all targets).
     * @returns {Promise<null>} Resolve after finish.
     */
    async inRelease ({ tg = 0 } = {}) {
      if (_.isNil(tg)) throw new TypeError('invalid tg')
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x52, data: new Packet([tg]) });
      const resp = await this.readRespTimeout({ cmd: 0x53 });
      const statusErr = hasPn532StatusError(resp.data[0]);
      if (statusErr) throw statusErr
      resp.data = resp.data.subarray(1);
      return resp
    }

    /**
     * This command is used to select the target Tg.
     * @async
     * @param {object} args
     * @param {number} args.tg A byte containing the logical number of the relevant target.
     * @returns {Promise<null>} Resolve after finish.
     */
    async inSelect ({ tg }) {
      if (!_.includes([1, 2], tg)) throw new TypeError('invalid tg')
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x54, data: new Packet([tg]) });
      const resp = await this.readRespTimeout({ cmd: 0x55 });
      const statusErr = hasPn532StatusError(resp.data[0]);
      if (statusErr) throw statusErr
      resp.data = resp.data.subarray(1);
      return resp
    }

    /**
     * This command is used to poll card(s) / target(s) of specified Type present in the RF field.
     * @async
     * @param {object} args
     * @param {number} args.pollNr specifies the number of polling (one polling is a polling for each Type).
     * - `0x01` ~ `0xFE`: polling upto 1 ~ 254 times.
     * - `0xFF`: Endless polling.
     * @param {number} args.period (`0x01` ~ `0x0F`) Indicates the polling period in units of `150 ms`.
     * @param {number[]} args.types Indicates the target types to be polled. Format for each type as following:
     *
     * ![](https://i.imgur.com/X3Y2ZWJ.png)
     * - bit 0-2: Baudrate and modulation
     *   - `0x0`: 106 kbps ISO/IEC14443 type A
     *   - `0x1`: 212 kbps
     *   - `0x2`: 424 kbps
     *   - `0x3`: 106 kbps ISO/IEC14443 type B
     *   - `0x4`: Innovision Jewel tag
     * - bit 3: RFU, set to `0`.
     * - bit 4: set to `1` if target is Mifare or FeliCa card.
     * - bit 5: set to `1` if target is ISO/IEC14443-4 compliant.
     * - bit 6: set to `1` if target is DEP.
     * - bit 7: set to `0` if target is passive mode, set to `1` if target is active mode.
     *
     * The possible types are listed below:
     * - `0x00`: Generic passive 106 kbps (ISO/IEC14443-4A, Mifare and DEP)
     * - `0x01`: Generic passive 212 kbps (FeliCa and DEP)
     * - `0x02`: Generic passive 424 kbps (FeliCa and DEP)
     * - `0x03`: Passive 106 kbps ISO/IEC14443-4B
     * - `0x04`: Innovision Jewel tag
     * - `0x10`: Mifare card
     * - `0x11`: FeliCa 212 kbps card
     * - `0x12`: FeliCa 424 kbps card
     * - `0x20`: Passive 106 kbps ISO/IEC14443-4A
     * - `0x23`: Passive 106 kbps ISO/IEC14443-4B
     * - `0x40`: DEP passive 106 kbps
     * - `0x41`: DEP passive 212 kbps
     * - `0x42`: DEP passive 424 kbps
     * - `0x80`: DEP active 106 kbps
     * - `0x81`: DEP active 212 kbps
     * - `0x82`: DEP active 424 kbps
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Pn532Frame>} Resolve with raw response need to be parsed.
     */
    async inAutoPoll ({ pollNr, period, types = [], timeout } = {}) {
      if (!_.isArray(types) || !types.length) throw new TypeError('invalid types')
      this.clearRespBuf();
      await this.sendCommandNormal({ cmd: 0x60, data: new Packet([pollNr, period, ...types]) });
      const resp = await this.readRespTimeout({ cmd: 0x61 });
      // TODO: parse response
      resp.nbTg = resp.data[0];
      resp.data = resp.data.subarray(1);
      return resp
    }
  }

  const version = '0.1.14';

  exports.Packet = Packet;
  exports.Pn532 = Pn532;
  exports.utils = utils;
  exports.version = version;

}));
