import _ from 'lodash'
import Crypto1 from './Crypto1'
import Packet from './Packet'

test('#reset()', async () => {
  const crypto = new Crypto1()
  crypto.setLfsr(Packet.fromHex('FFFFFFFFFFFF'))
  crypto.reset()
  expect(crypto.odd).toEqual(0)
  expect(crypto.even).toEqual(0)
})

test.each([
  { key: 'FFFFFFFFFFFF', odd: 0xFFFFFF, even: 0xFFFFFF },
  { key: 'AAAAAAAAAAAA', odd: 0xFFFFFF, even: 0 },
  { key: '555555555555', odd: 0, even: 0xFFFFFF },
])('#setLfsr(Packet.fromHex($key)) = { odd: $odd, even: $even }', async ({ key, odd, even }) => {
  const crypto = new Crypto1()
  crypto.setLfsr(Packet.fromHex(key))
  expect(crypto.odd).toEqual(odd)
  expect(crypto.even).toEqual(even)
})

test.each([
  { key: 'FFFFFFFFFFFF' },
  { key: '000000000000' },
  { key: '123456789012' },
  { key: '112233445566' },
  { key: 'ABCDEFABCDEF' },
])('#setLfsr(Packet.fromHex($key))#getLfsr() = $key', async ({ key }) => {
  const crypto1 = new Crypto1()
  crypto1.setLfsr(Packet.fromHex(key))
  expect(crypto1.getLfsr().hex).toEqual(key)
})

test.each([
  { input: -1, expected: 0xFFFFFFFF },
  { input: 0x00000001 << 8, expected: 0x00000100 },
  { input: 0x12345678 << 4, expected: 0x23456780 },
  { input: 0x80000000 << 1, expected: 0x0 },
])('.toUint32($input) = $expected', async ({ input, expected }) => {
  const actual = Crypto1.toUint32(input)
  expect(actual).toEqual(expected)
})

test.each([
  { input: -1, expected: 0xFF },
  { input: 0x1 << 8, expected: 0x0 },
  { input: 0xFF, expected: 0xFF },
])('.toUint8($input) = $expected', async ({ input, expected }) => {
  const actual = Crypto1.toUint8(input)
  expect(actual).toEqual(expected)
})

test.each([
  { input: -1, expected: 1 },
  { input: 0, expected: 0 },
  { input: 1, expected: 1 },
  { input: 2, expected: 0 },
])('.toBit($input) = $expected', async ({ input, expected }) => {
  const actual = Crypto1.toBit(input)
  expect(actual).toEqual(expected)
})

test.each([
  { input: -1, expected: 1 },
  { input: 0, expected: 0 },
  { input: 1, expected: 1 },
  { input: 2, expected: 1 },
])('.toBool($input) = $expected', async ({ input, expected }) => {
  const actual = Crypto1.toBool(input)
  expect(actual).toEqual(expected)
})

test.each([
  { x: -1, n: 0, expected: 1 },
  // 0xA5 = 0b10100101
  { x: 0xA5, n: 0, expected: 1 },
  { x: 0xA5, n: 1, expected: 0 },
  { x: 0xA5, n: 2, expected: 1 },
  { x: 0xA5, n: 3, expected: 0 },
  { x: 0xA5, n: 4, expected: 0 },
  { x: 0xA5, n: 5, expected: 1 },
  { x: 0xA5, n: 6, expected: 0 },
  { x: 0xA5, n: 7, expected: 1 },
])('.bit($x, $n) = $expected', async ({ x, n, expected }) => {
  const actual = Crypto1.bit(x, n)
  expect(actual).toEqual(expected)
})

test.each([
  { x: -1, n: 0, expected: 1 },
  // 0xA5 = 0b10100101
  { x: 0xA5, n: 0, expected: 0 },
  { x: 0xA5, n: 1, expected: 0 },
  { x: 0xA5, n: 2, expected: 0 },
  { x: 0xA5, n: 3, expected: 0 },
  { x: 0xA5, n: 4, expected: 0 },
  { x: 0xA5, n: 5, expected: 0 },
  { x: 0xA5, n: 6, expected: 0 },
  { x: 0xA5, n: 7, expected: 0 },
])('.beBit($x, $n) = $expected', async ({ x, n, expected }) => {
  const actual = Crypto1.beBit(x, n)
  expect(actual).toEqual(expected)
})

test.each([
  { x: -1, expected: 0 },
  { x: 0, expected: 0 },
  { x: 1, expected: 1 },
  { x: 0x87, expected: 0 },
])('.evenParity8($x) = $expected', async ({ x, expected }) => {
  const actual = Crypto1.evenParity8(x)
  expect(actual).toEqual(expected)
})

test.each([
  { x: -1, expected: 0 },
  { x: 0, expected: 0 },
  { x: 1, expected: 1 },
  { x: 87654321, expected: 1 },
])('.evenParity32($x) = $expected', async ({ x, expected }) => {
  const actual = Crypto1.evenParity32(x)
  expect(actual).toEqual(expected)
})

test.each([
  { x: 0x12345678, expected: 0x78563412 },
  { x: -1, expected: 0xFFFFFFFF },
  { x: 0x100000000, expected: 0x0 },
])('.swapEndian($x) = $expected', async ({ x, expected }) => {
  const actual = Crypto1.swapEndian(x)
  expect(actual).toEqual(expected)
})

test.each([
  { nt: 'CB7B9ED9', expected: 'CE110A87' },
  { nt: '1E6D9228', expected: 'DC74D694' },
])('.prngSuccessor(0x$nt, 64) = 0x$expected', async ({ nt, expected }) => {
  const actual = Crypto1.prngSuccessor(_.parseInt(nt, 16), 64)
  expect(`0000000${actual.toString(16).toUpperCase()}`.slice(-8)).toEqual(expected)
})

test.each([
  { even: 3921859194, odd: 3552613021, input: 0, isEncrypted: 0, expected: { even: 10883010, odd: 4791744 } },
  { even: 10883010, odd: 4791744, input: 0x5A8FFEC6, isEncrypted: 1, expected: { even: 12006054, odd: 9214537 } },
  { even: 12006054, odd: 9214537, input: 0x65535D33 ^ 0xCB7B9ED9, isEncrypted: 0, expected: { even: 10131127, odd: 3091084 } },
])('new Crypto1({ even: $even, odd: $odd }).lfsrRollbackWord($input, $isEncrypted)', async ({ even, odd, input, isEncrypted, expected }) => {
  const state = new Crypto1()
  ;[state.even, state.odd] = [even, odd]
  state.lfsrRollbackWord(input, isEncrypted)
  expect(_.pick(state, ['even', 'odd'])).toEqual(expected)
})

test.each([
  { even: 10131127, odd: 3091084, expected: '61BB6136535E' },
])('new Crypto1({ even: $even, odd: $odd }).getLfsr() = "$expected"', async ({ even, odd, expected }) => {
  const state = new Crypto1()
  ;[state.even, state.odd] = [even, odd]
  const actual = state.getLfsr()
  expect(actual.hex).toEqual(expected)
})

test.each([
  {
    uid: '65535D33',
    nt0: 'CB7B9ED9',
    nr0: '5A8FFEC6',
    ar0: '5C7C6F89',
    nt1: '1E6D9228',
    nr1: '6FB8B4A8',
    ar1: 'EF4039FB',
    expected: 'A9AC67832330',
  },
])('.mfkey32v2()', async ({ uid, nt0, nr0, ar0, nt1, nr1, ar1, expected }) => {
  const actual = Crypto1.mfkey32v2({ uid, nt0, nr0, ar0, nt1, nr1, ar1 })
  expect(actual.hex).toEqual(expected)
})

test.each([
  {
    uid: '65535D33',
    nt: '2C198BE4',
    nr: 'FEDAC6D2',
    ar: 'CF0A3C7E',
    at: 'F4A81AF8',
    expected: 'A9AC67832330',
  },
])('.mfkey64()', async ({ uid, nt, nr, ar, at, expected }) => {
  const actual = Crypto1.mfkey64({ uid, nt, nr, ar, at })
  expect(actual.hex).toEqual(expected)
})

test.each([
  {
    uid: '65535D33',
    nt: '2C198BE4',
    nr: 'FEDAC6D2',
    key: 'A9AC67832330',
    data: 'FB07EA8F31C89B3B36F54DA1E9784E85EB8F530C391F9383191C',
    expected: '30084A2446000000B9FFFFFF4600000000FF00FFA601500057CD',
  },
  {
    uid: '65535D33',
    nt: 'F73E638F',
    nr: '4F4F867A',
    key: 'A9AC67832330',
    data: 'B334670F0686E45AA7D74B69D3B47CADB68013F52A92535B2888',
    expected: '30084A2446000000B9FFFFFF4600000000FF00FFA601500057CD',
  },
  { uid: 'DE7752AC', nt: 'A95A83FD', nr: '47ED9EB7', key: '000000000000', data: 'B8500C47', expected: 'A8009F7F' },
  { uid: 'F235061B', nt: '39264142', nr: 'B8F4A737', key: '000000000000', data: 'B2AF219B', expected: 'A83C7084' },
])('.decrypt()', async ({ uid, nt, nr, key, data, expected }) => {
  const actual = Crypto1.decrypt({
    data: Packet.fromHex(data),
    key: Packet.fromHex(key),
    nr: Packet.fromHex(nr),
    nt: Packet.fromHex(nt),
    uid: Packet.fromHex(uid),
  })
  expect(actual.hex).toEqual(expected)
})
