import _ from 'lodash'
import Packet from './Packet.js'

describe('Packet.fromView()', () => {
  test('with TypedArray', async () => {
    const view = new Uint8Array([0, 1, 2, 3, 4]).subarray(1, 4)
    const actual = Packet.fromView(view).hex
    expect(actual).toEqual('010203')
  })

  test('with DataView', async () => {
    const view = new DataView(new Uint8Array([0, 1, 2, 3, 4]).buffer, 1, 3)
    const actual = Packet.fromView(view).hex
    expect(actual).toEqual('010203')
  })

  test('with ArrayBuffer', async () => {
    const view = new Uint8Array([0, 1, 2, 3, 4]).buffer
    expect(() => Packet.fromView(view)).toThrow(TypeError)
  })
})

test.each([
  ['0123456789ABCDEF', '0123456789ABCDEF'],
  ['0123456789abcdef', '0123456789ABCDEF'],
  ['01 23 45 67 89 AB CD EF', '0123456789ABCDEF'],
  ['0 1 2 3 4 5 6 7 8 9 A B C D E F', '0123456789ABCDEF'],
  ['01\n23\n45\n67\n89\nAB\nCD\nEF', '0123456789ABCDEF'],
  ['', ''],
])('Packet.fromHex(%j).hex = %j', async (input, expected) => {
  const actual = Packet.fromHex(input).hex
  expect(actual).toEqual(expected)
})

test.each([
  ['0123456789ABCDEF', 'EFCDAB8967452301'],
  ['0123456789abcdef', 'EFCDAB8967452301'],
  ['01 23 45 67 89 AB CD EF', 'EFCDAB8967452301'],
  ['0 1 2 3 4 5 6 7 8 9 A B C D E F', 'EFCDAB8967452301'],
  ['01\n23\n45\n67\n89\nAB\nCD\nEF', 'EFCDAB8967452301'],
  ['', ''],
])('Packet.fromHex(%j, true).hex = %j', async (input, expected) => {
  const actual = Packet.fromHex(input, true).hex
  expect(actual).toEqual(expected)
})

test.each([
  ['hello world', '68656C6C6F20776F726C64'],
  ['', ''],
])('Packet.fromUtf8(%j).hex = %j', async (input, expected) => {
  const actual = Packet.fromUtf8(input).hex
  expect(actual).toEqual(expected)
})

test.each([
  ['68656C6C6F20776F726C64', 'hello world'],
  ['', ''],
])('Packet.fromHex(%j).utf8 = %j', async (input, expected) => {
  const actual = Packet.fromHex(input).utf8
  expect(actual).toEqual(expected)
})

describe('Packet.merge()', () => {
  test('return empty Packet with 0 argument', async () => {
    const actual = Packet.merge().hex
    expect(actual).toEqual('')
  })

  test('return the same Packet with 1 argument', async () => {
    const actual = Packet.merge(new Packet([0, 1])).hex
    expect(actual).toEqual('0001')
  })

  test('return the merged Packet with 2 argument', async () => {
    const actual = Packet.merge(new Packet([0, 1]), new Packet([2, 3])).hex
    expect(actual).toEqual('00010203')
  })
})

describe('Packet.isLen()', () => {
  test('return false with invalid type', async () => {
    const actual = Packet.isLen('')
    expect(actual).toEqual(false)
  })

  test('return true with Packet', async () => {
    const actual = Packet.isLen(new Packet([0, 1]))
    expect(actual).toEqual(true)
  })

  test('return false with invalid type and unexpected length', async () => {
    const actual = Packet.isLen('', 1)
    expect(actual).toEqual(false)
  })

  test('return false with Packet and unexpected length', async () => {
    const actual = Packet.isLen(new Packet([0, 1]), 1)
    expect(actual).toEqual(false)
  })

  test('return true with Packet and expected length', async () => {
    const actual = Packet.isLen(new Packet([0, 1]), 2)
    expect(actual).toEqual(true)
  })
})

describe('Packet#isEqual()', () => {
  test('return false with invalid type', async () => {
    const actual = new Packet([0, 1]).isEqual('')
    expect(actual).toEqual(false)
  })

  test('return false with different data packet', async () => {
    const actual = new Packet([0, 1]).isEqual(new Packet([0]))
    expect(actual).toEqual(false)
  })

  test('return false with same length different data packet', async () => {
    const actual = new Packet([0, 1]).isEqual(new Packet([2, 3]))
    expect(actual).toEqual(false)
  })

  test('return true with same data packet', async () => {
    const actual = new Packet([0, 1]).isEqual(new Packet([0, 1]))
    expect(actual).toEqual(true)
  })
})

test('Packet#chunk()', async () => {
  const actual = Packet.fromHex('00010203').chunk(3)
  expect(actual[0].hex).toEqual('000102')
  expect(actual[1].hex).toEqual('03')
})

test('Packet#xor', async () => {
  const actual = Packet.fromHex('01020304').xor
  expect(actual).toEqual(0x04)
})

test('Packet#hex', async () => {
  const actual = new Packet([0, 1, 2])
  expect(actual.hex).toEqual('000102')
})

test('Packet#rhex', async () => {
  const actual = new Packet([0, 1, 2])
  expect(actual.rhex).toEqual('020100')
})

test('Packet#inspect', async () => {
  const actual = new Packet([0, 1, 2])
  expect(actual.inspect).toEqual('Packet(3): 00 01 02')
})

test('Packet#toJSON', async () => {
  const actual = new Packet([0, 1, 2])
  expect(actual.toJSON()).toEqual('Packet(3): 000102')
})

test.each([
  ['000000', false, 0],
  ['FFFFFF', false, 16777215],
  ['7FFFFF', false, 8388607],
  ['800000', false, 8388608],
  ['000000', true, 0],
  ['FFFFFF', true, 16777215],
  ['FFFF7F', true, 8388607],
  ['000080', true, 8388608],
])('Packet.fromHex(%j).getUint24(0, %j) = %j', async (hex, little, expected) => {
  const actual = Packet.fromHex(hex).getUint24(0, little)
  expect(actual).toEqual(expected)
})

test.each([
  ['000000', false, 0],
  ['FFFFFF', false, -1],
  ['7FFFFF', false, 8388607],
  ['800000', false, -8388608],
  ['000000', true, 0],
  ['FFFFFF', true, -1],
  ['FFFF7F', true, 8388607],
  ['000080', true, -8388608],
])('Packet.fromHex(%j).getInt24(0, %j) = %j', async (hex, little, expected) => {
  const actual = Packet.fromHex(hex).getInt24(0, little)
  expect(actual).toEqual(expected)
})

test.each([
  [0, false, '000000'],
  [16777215, false, 'FFFFFF'],
  [8388607, false, '7FFFFF'],
  [8388608, false, '800000'],
  [0, true, '000000'],
  [16777215, true, 'FFFFFF'],
  [8388607, true, 'FFFF7F'],
  [8388608, true, '000080'],
])('new Packet(3).setUint24(0, %j, %j).hex = %j', async (num, little, expected) => {
  const actual = new Packet(3).setUint24(0, num, little).hex
  expect(actual).toEqual(expected)
})

test.each([
  [0, false, '000000'],
  [-1, false, 'FFFFFF'],
  [8388607, false, '7FFFFF'],
  [-8388608, false, '800000'],
  [0, true, '000000'],
  [-1, true, 'FFFFFF'],
  [8388607, true, 'FFFF7F'],
  [-8388608, true, '000080'],
])('new Packet(3).setInt24(0, %j, %j).hex = %j', async (num, little, expected) => {
  const actual = new Packet(3).setInt24(0, num, little).hex
  expect(actual).toEqual(expected)
})

test.each([
  ['1', 'MQ'],
  ['12', 'MTI'],
  ['123', 'MTIz'],
])('Packet.fromUtf8(%j).base64url = %j', async (hex, expected) => {
  const actual = Packet.fromUtf8(hex).base64url
  expect(actual).toEqual(expected)
})

test.each([
  ['-_-_', '-_-_'],
  ['+/+/', '-_-_'],
  ['MQ', 'MQ'],
  ['MTI', 'MTI'],
  ['MTIz', 'MTIz'],
  ['SGVs/G8+d29ybGQ', 'SGVs_G8-d29ybGQ'],
])('Packet.fromBase64(%j).base64url = %j', async (hex, expected) => {
  const actual = Packet.fromBase64(hex).base64url
  expect(actual).toEqual(expected)
})

test.each([
  ['-_-_', '+/+/'],
  ['+/+/', '+/+/'],
  ['MQ', 'MQ=='],
  ['MTI', 'MTI='],
  ['MTIz', 'MTIz'],
  ['SGVs_G8-d29ybGQ', 'SGVs/G8+d29ybGQ='],
])('Packet.fromBase64(%j).base64 = %j', async (hex, expected) => {
  const actual = Packet.fromBase64(hex).base64
  expect(actual).toEqual(expected)
})

test.each([
  ['12', 8],
  ['1234', 16],
  ['123456', 24],
  ['FF', 8],
  ['FFFF', 16],
  ['FFFFFF', 24],
])('Packet.fromHex(%j).getBit(offset)', async (hex, bits) => {
  const pack = Packet.fromHex(hex)
  const actual = _.times(bits, i => `${pack.getBit(i)}`).reverse().join('')
  expect(actual).toEqual(BigInt(`0x${hex}`).toString(2).padStart(bits, '0'))
})

test.each([
  ['12', 8],
  ['1234', 16],
  ['12345678', 32],
  ['FF', 8],
  ['FFFF', 16],
  ['FFFFFFFF', 32],
])('Packet.fromHex(%j).getBit(offset, true)', async (hex, bits) => {
  const pack = Packet.fromHex(hex)
  const actual = _.times(bits, i => `${pack.getBit(i, true)}`).join('')
  expect(actual).toEqual(BigInt(`0x${hex}`).toString(2).padStart(bits, '0'))
})
