import _ from 'lodash'
import { ReadableStream, TransformStream, WritableStream } from 'web-streams-polyfill/ponyfill'
import HexMockAdapter from './plugin/HexMockAdapter.js'
import Packet from './Packet.js'
import Pn532, { Pn532FrameNormal, Pn532FrameExtended } from './Pn532.js'

beforeAll(() => {
  global.ReadableStream = ReadableStream
  global.TransformStream = TransformStream
  global.WritableStream = WritableStream
})

describe('Pn532FrameNormal', () => {
  test('get frame data', async () => {
    // arrange
    const pack = Packet.fromHex('0000FF0CF4D54B0101000408049D44A3460400')

    // action
    const sut = new Pn532FrameNormal(pack)

    // assert
    expect(sut.data.hex).toEqual('0101000408049D44A346')
  })

  test('getAppErr()', async () => {
    // arrange
    const pack = Packet.fromHex('0000FF01FF01FF00')

    // action
    const sut = new Pn532FrameNormal(pack)

    // assert
    expect(sut.getAppErr()?.message).toEqual('Time Out, the target has not answered')
  })

  test.each([
    ['0000FF00FF00', 'invalid pack length'],
    ['0000FFFFFF0002FFD54300', 'invalid pack length'],
    ['0000FF02FFD54300', 'invalid pack length'],
    ['0000FF01FED54300', 'invalid len and lcs'],
    ['0000FF01FFD50000', 'invalid dcs'],
  ])('getFrameErr(%j) = %j', async (input, expected) => {
    // arrange
    const pack = Packet.fromHex(input)

    // action
    const sut = new Pn532FrameNormal(pack)

    // assert
    expect(sut.getFrameErr()).toEqual(expected)
  })
})

describe('Pn532FrameExtended', () => {
  test('get frame data', async () => {
    // arrange
    const pack = Packet.fromHex('0000FFFFFF0003FDD500004200')

    // action
    const sut = new Pn532FrameExtended(pack)

    // assert
    expect(sut.data.hex).toEqual('00')
  })

  test('error frame', async () => {
    // arrange
    const pack = Packet.fromHex('0000FFFFFF0001FF01FF00')

    // action
    const sut = new Pn532FrameExtended(pack)

    // assert
    expect(sut.getAppErr()?.message).toEqual('Time Out, the target has not answered')
  })

  test.each([
    ['0000FF00FF00', 'invalid pack length'],
    ['0000FF02FFD54300', 'invalid pack length'],
    ['0000FFFFFF0002FFD54300', 'invalid pack length'],
    ['0000FFFFFF0001FED54300', 'invalid len and lcs'],
    ['0000FFFFFF0001FFD50000', 'invalid dcs'],
  ])('getFrameErr(%j) = %j', async (input, expected) => {
    // arrange
    const pack = Packet.fromHex(input)

    // action
    const sut = new Pn532FrameExtended(pack)

    // assert
    expect(sut.getFrameErr()).toEqual(expected)
  })
})

describe('Pn532#rx', () => {
  test('chunks can be transform to pn532 resp', async () => {
    // arrange
    const sut = new Pn532()
    const writer = sut.rx.writable.getWriter()
    const input = Packet.fromHex('0000FF00FF000000FF0CF4D54B0101000408049D44A3460400')

    // action
    for (const chunk of input.chunk(16)) await writer.write(chunk)
    writer.releaseLock()

    // assert
    const actuals = _.map(sut.respBuf, 'pack.hex')
    expect(actuals).toEqual([
      '0000FF00FF00',
      '0000FF0CF4D54B0101000408049D44A3460400',
    ])
  })
})

test('Pn532#sendCommandWakeup()', async () => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF02FED5151600'] // response
  sut.use(adapter)

  // action
  await sut.sendCommandWakeup()

  // assert
  expect(adapter.txHex).toEqual(['55550000000000000000000000000000FF05FBD4140114010200'])
})

test('Pn532#getFirmwareVersion()', async () => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF06FAD50332010607E800'] // response
  sut.use(adapter)

  // action
  const actual = await sut.getFirmwareVersion()

  // assert
  expect(adapter.txHex).toEqual(['0000FF02FED4022A00'])
  expect(actual).toEqual({
    firmware: '1.6',
    ic: 'PN532',
    iso14443a: true,
    iso14443b: true,
    iso18092: true,
  })
})

test('Pn532#readRegisters()', async () => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF05FBD507400005DF00'] // response
  sut.use(adapter)

  // action
  const actual = await sut.readRegisters([0x6305, 0x630D, 0x6338])

  // assert
  expect(adapter.txHex).toEqual(['0000FF08F8D4066305630D6338B300'])
  expect(actual).toEqual({
    0x6305: 0x40,
    0x630D: 0x00,
    0x6338: 0x05,
  })
})

test('Pn532#writeRegisters()', async () => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF02FED5092200'] // response
  sut.use(adapter)

  // action
  await sut.writeRegisters({
    0x6305: 0x40,
    0x630D: 0x00,
    0x6338: 0x05,
  })

  // assert
  expect(adapter.txHex).toEqual(['0000FF0BF5D408630540630D006338056C00'])
})

test('Pn532#readGpio()', async () => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF05FBD50D3F0700D800'] // response
  sut.use(adapter)

  // action
  const actual = await sut.readGpio()

  // assert
  expect(adapter.txHex).toEqual(['0000FF02FED40C2000'])
  expect(actual).toEqual({
    p30: 1,
    p31: 1,
    p32: 1,
    p33: 1,
    p34: 1,
    p35: 1,
    p71: 1,
    p72: 1,
    i0: 0,
    i1: 0,
  })
})

test('Pn532#writeGpio()', async () => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF02FED50F1C00'] // response
  sut.use(adapter)

  // action
  await sut.writeGpio({
    p30: 1,
    p31: 1,
    p32: 1,
    p33: 1,
    p34: 1,
    p35: 1,
    p71: 1,
    p72: 1,
    i0: 0,
    i1: 0,
  })

  // assert
  expect(adapter.txHex).toEqual(['0000FF04FCD40E00001E00'])
})

test.each([
  [{}, '0000FF04FCD41401140300'],
  [{ irq: 1 }, '0000FF05FBD4140114010200'],
  [{ mode: 2, timeout: 0xFF }, '0000FF04FCD41402FF1700'],
  [{ mode: 3 }, '0000FF04FCD41403140100'],
  [{ mode: 4 }, '0000FF04FCD41404140000'],
])('Pn532#samConfiguration(%j)', async (args, tx) => {
  // arrange
  const sut = new Pn532()
  const adapter = new HexMockAdapter()
  adapter.rxHex = ['0000FF02FED5151600'] // response
  sut.use(adapter)

  // action
  await sut.samConfiguration(args)

  // assert
  expect(adapter.txHex).toEqual([tx])
})
