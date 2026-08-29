/**
 * @module pn532.js/plugin/Hf14a
 * @example
 * import Pn532Hf14a from 'pn532.js/plugin/Hf14a'
 */
import _ from 'lodash'

/**
 * The Hf14a plugin for PN532. After register to PN532 instance, this plugin will expose plugin functions under `pn532.$hf14a`.
 * @example
 * const pn532 = new Pn532()
 * pn532.use(new Pn532WebserialAdapter()) // A pn532 instance must register exactly one adapter plugin
 * pn532.use(new Pn532Hf14a())
 */
export default class Pn532Hf14a {
  name = 'hf14a'

  install (context, pluginOption) {
    const { Packet, pn532, utils } = context
    const { retry } = utils

    function isAdapterOpen () {
      return pn532?.$adapter?.isOpen?.()
    }

    /**
     * @typedef {object} Pn532Hf14a~MifareTarget
     * @property {Packet} atqa 2 bytes ATQA of target (aka `SENS_RES`).
     * @property {Packet} pack raw data of response
     * @property {Packet} rats Request for answer to select
     * @property {Packet} sak 1 byte SAK of target (aka `SEL_RES`).
     * @property {Packet} uid 4, 7 or 10 bytes uid of target.
     */

    /**
     * This command is used to detect as many mifare targets (maximum `MaxTg`) as possible in passive mode.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.maxTg The maximum number of mifare targets to be initialized by the PN532. The PN532 is capable of handling 2 targets maximum at once, so this field should not exceed `0x02`.
     * @param {Packet} args.uid Set to UID of card if wants to initialize a target with a known UID.
     * @param {number=3e4} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Pn532Hf14a~MifareTarget[]>} Resolve with an array of detected mifare targets.
     */
    async function inListPassiveTarget ({ maxTg = 1, uid = new Packet(), timeout } = {}) {
      const uidct = new Packet([0x88])
      if (uid.length === 7) uid = Packet.merge(uidct, uid)
      else if (uid.length === 10) uid = Packet.merge(uidct, uid.subarray(0, 3), uidct, uid.subarray(3))
      const { data: resData } = await pn532.inListPassiveTarget({ maxTg, brTy: 0, data: uid, timeout })
      const targets = _.times(resData[0], () => ({}))
      const format = _.find([0b0000, 0b1000, 0b1100, 0b1010, 0b1110, 0b1011, 0b1111], flags => {
        try {
          // bits: tg0, rats0, tg1, rats1
          const bits = _.map((0x10 + flags).toString(2).slice(-4), _.parseInt)
          if (bits[0] + bits[2] !== targets.length) return false
          let posTarget = 1
          for (let i = 0; i < targets.length; i++) {
            const target = targets[i]
            target.pack = resData.subarray(posTarget)
            if (target.pack[0] !== i + 1) return false

            const uidlen = target.pack[4]
            if (!_.includes([4, 7, 10], uidlen)) return false
            const ratslen = bits[i * 2 + 1] ? target.pack[5 + uidlen] : 0
            const packlen = 5 + uidlen + bits[i * 2 + 1] + ratslen
            target.pack = target.pack.subarray(0, packlen)

            target.atqa = target.pack.subarray(1, 3)
            target.sak = target.pack.subarray(3, 4)
            target.uid = target.pack.subarray(5, 5 + uidlen)
            target.rats = target.pack.subarray(6 + uidlen)
            if (target.rats.length !== ratslen) return false
            posTarget += packlen
          }
          return true
        } catch (err) {
          return false
        }
      })
      if (!format) throw new Error('invalid hf14a target format')
      return targets
    }

    /**
     * Because {@link Pn532#testTargetPresent} failed to detect JCOP31 target so we need to do it manually.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @returns {Promise<boolean>} Resolve with a boolean indicating whether or not the ISO/IEC14443-4 card is present.
     * @see https://github.com/nfc-tools/libnfc/blob/3df7f25f11499fa788e40c41ee7b45582262c566/libnfc/chips/pn53x.c#L1999
     */
    async function testIso14443Part4Present () {
      let isPresent = false
      await retry(async () => {
        await pn532.inCommunicateThru({ data: Packet.fromHex('B2') })
        isPresent = true
      })
      return isPresent
    }

    async function inReleaseIfOpened () {
      if (isAdapterOpen()) await pn532.inRelease().catch(() => {})
    }

    /**
     * This function is used to detect one mifare target in passive mode. It will release the target if reader connection is opened.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number=3e4} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Pn532Hf14a~MifareTarget>} Resolve with detected mifare target.
     */
    async function mfSelectCard ({ timeout } = {}) {
      try {
        return (await inListPassiveTarget({ timeout }))?.[0]
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * This function is used to authenticate block with a specific key type and key.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be authenticated.
     * @param {boolean} args.isKb Type of the key. `0`: key A, `1`: key B.
     * @param {Packet} args.key 6 bytes key to authenticate the block.
     * @param {number} args.tg A byte containing the logical number of the relevant target.
     * @param {Packet} args.uid Uid of the target to be authenticated. Currently only accepted 4 bytes uid.
     * @param {number} args.blocksPerSector A integer represent how many blocks per sector.
     * @returns {Promise<null>} Resolve after finish.
     */
    async function mfAuthBlock ({ block = 0, isKb = 0, key, tg = 1, uid, blocksPerSector = 4 } = {}) {
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      if (!Packet.isLen(uid)) throw new TypeError('invalid uid')
      if (!_.includes([4, 7, 10], uid.length)) throw new TypeError('invalid uid length')
      isKb = isKb ? 1 : 0
      block += blocksPerSector - (block % blocksPerSector) - 1
      try {
        await pn532.inDataExchange({ tg, data: new Packet([0x60 + isKb, block, ...key, ...uid.subarray(0, 4)]) })
      } catch (err) {
        throw new Error(`Failed to auth block ${block}`)
      }
    }

    /**
     * This function is used to validate the Access Control Bits of the sector.
     * @memberof Pn532Hf14a
     * @instance
     * @param {Packet} acl 3 bytes containing the Access Control Bits of the sector.
     * @returns {boolean} Indicating whether or not the `acl` is valid.
     */
    function mfIsValidAcl (acl) {
      const u4arr = _.flatten(_.times(3, i => [(acl[i] & 0xF0) >>> 4, acl[i] & 0xF]))
      return _.every([[1, 2], [0, 5], [3, 4]], ([a, b]) => u4arr[a] ^ u4arr[b] === 0xF)
    }

    /**
     * This function is used to remove key that is invalid or duplicated in array.
     * @memberof Pn532Hf14a
     * @instance
     * @param {Array<Packet>} keys Array of 6 bytes key.
     * @returns {Array<Packet>} Result.
     */
    function mfKeysUniq (keys) {
      if (!_.isArray(keys)) throw new TypeError('invalid keys')
      return _.chain(keys)
        .filter(key => Packet.isLen(key, 6))
        .uniqWith((val1, val2) => val1.isEqual(val2))
        .value()
    }

    async function mfReadBlockHelper (readOpts, authOpts) {
      const resp = await retry(async () => {
        try {
          return await pn532.inDataExchange(readOpts)
        } catch (err) {
          if (!isAdapterOpen()) throw err // rethrow error if adapter is closed
          await pn532.inDeselect({ tg: 1 }).catch(() => {})
          await mfAuthBlock(authOpts).catch(() => {}) // assumed the key is correct, so ignore error
          throw new Error(`Failed to read block ${readOpts?.data?.[1]}`)
        }
      })
      return resp?.data
    }

    function mfBlockRespValidator (resp) {
      return resp.data[0] !== 0x00 || Packet.isLen(resp.data, 17)
    }

    /**
     * Read block data from target by specific key type and key.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be authenticated and read.
     * @param {boolean} args.isKb Type of the key. `0`: key A, `1`: key B.
     * @param {Packet} args.key 6 bytes key to authenticate the block.
     * @returns {Promise<Packet>} Resolve with 16 bytes block data.
     */
    async function mfReadBlock ({ block = 0, isKb = 0, key } = {}) {
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      isKb = isKb ? 1 : 0
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfAuthBlock({ block, isKb, key, uid })
        return await mfReadBlockHelper(
          { data: new Packet([0x30, block]), respValidator: mfBlockRespValidator },
          { block, isKb, key, uid },
        )
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Read block data from target by key B and key A.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be authenticated and read.
     * @param {Packet} args.ka 6 bytes Key A of the block.
     * @param {Packet} args.kb 6 bytes Key B of the block.
     * @returns {Promise<Packet>} Resolve with 16 bytes block data.
     */
    async function mfReadBlockKeyBA ({ block = 0, ka, kb } = {}) {
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        for (let isKb = 1; isKb >= 0; isKb--) {
          try {
            const key = [ka, kb][isKb]
            await mfAuthBlock({ block, isKb, key, uid })
            return await mfReadBlockHelper(
              { data: new Packet([0x30, block]), respValidator: mfBlockRespValidator },
              { block, isKb, key, uid },
            )
          } catch (err) {
            if (!isAdapterOpen()) throw err
            await pn532.inDeselect({ tg: 1 }).catch(() => {})
          }
        }
        throw new Error(`Failed to read block ${block}`)
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Read sector data from target by specific key type and key.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sector Which sector to be authenticated and read.
     * @param {boolean} args.isKb Type of the key. `0`: key A, `1`: key B.
     * @param {Packet} args.key 6 bytes key to authenticate the sector.
     * @returns {Promise<Packet>} Resolve with 64 bytes sector data.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.data` ({@link Packet}): 64 bytes sector data. Block data that failed to read will be filled with `0x00`.
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block read successfully. There are 4 blocks in sector.
     */
    async function mfReadSector ({ sector = 0, isKb = 0, key } = {}) {
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      isKb = isKb ? 1 : 0
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfAuthBlock({ block: sector * 4, isKb, key, uid })
        const data = new Packet(64)
        const success = [0, 0, 0, 0]
        for (let i = 0; i < 4; i++) {
          try {
            const block = sector * 4 + i
            const blockData = await mfReadBlockHelper(
              { data: new Packet([0x30, block]), respValidator: mfBlockRespValidator },
              { block: sector * 4, isKb, key, uid },
            )
            data.set(blockData, i * 16)
            success[i] = 1
          } catch (err) {
            if (!isAdapterOpen()) throw err
          }
        }
        data.set(key, [48, 58][isKb])
        return { data, success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Read sector data from target by key B and key A.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sector Which sector to be authenticated and read.
     * @param {Packet} args.ka 6 bytes Key A of the sector.
     * @param {Packet} args.kb 6 bytes Key B of the sector.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.data` ({@link Packet}): 64 bytes sector data. Block data that failed to read will be filled with `0x00`.
     * - `res.success.read` (Array<{@link boolean}>): Indicating whether or not the block read successfully. There are 4 blocks in sector.
     * - `res.success.key` (Array<{@link boolean}>): Indicating whether or not the key has authenticated successfully.
     */
    async function mfReadSectorKeyBA ({ sector = 0, ka, kb } = {}) {
      try {
        const data = new Packet(64)
        const success = { key: [0, 0], read: [0, 0, 0, 0] }
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        for (let isKb = 1; isKb >= 0; isKb--) {
          try {
            const key = [ka, kb][isKb]
            await mfAuthBlock({ block: sector * 4, isKb, key, uid })
            success.key[isKb] = 1
            for (let i = 0; i < 4; i++) {
              try {
                if (success.read[i]) continue
                const block = sector * 4 + i
                const blockData = await mfReadBlockHelper(
                  { data: new Packet([0x30, block]), respValidator: mfBlockRespValidator },
                  { block: sector * 4, isKb, key, uid },
                )
                data.set(blockData, i * 16)
                success.read[i] = 1
              } catch (err) {
                if (!isAdapterOpen()) throw err
              }
            }
          } catch (err) {
            if (!isAdapterOpen()) throw err
            await pn532.inDeselect({ tg: 1 }).catch(() => {})
          }
        }
        for (let isKb = 0; isKb < 2; isKb++) { // fill key
          if (!success.key[isKb]) continue
          data.set([ka, kb][isKb], [48, 58][isKb])
        }
        return { data, success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Check sector key of Mifare card.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sectorMax How many sectors to read from target.
     * @param {Packet[]} args.keys Array of 6 bytes keys to be check.
     * @returns {Promise<Packet[]>} Resolve with array of sector key As and key Bs. Odd Index (`0`, `2`, `4`...) are Key A, even index (`1`, `3`, `5`...) are Key B. If the sector key is not found, the value will be `null`.
     */
    async function mfCheckKeys ({ sectorMax = 16, keys } = {}) {
      try {
        keys = mfKeysUniq(keys)
        if (!keys.length) throw new TypeError('invalid keys')
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        const sectorKeys = Array(sectorMax * 2).fill(null)
        for (let i = 0; i < sectorMax; i++) {
          for (let isKb = 0; isKb < 2; isKb++) {
            const block = i * 4 + 3
            for (const key of keys) {
              try {
                await mfAuthBlock({ block, isKb, key, uid })
                sectorKeys[i * 2 + isKb] = key
                break
              } catch (err) {
                if (!isAdapterOpen()) throw err
                await pn532.inDeselect({ tg: 1 }).catch(() => {})
              }
            }
          }
        }
        return sectorKeys
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Read all sector data from target. This function will try to auth sector by `keys`.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sectorMax How many sectors to read from target.
     * @param {Packet[]} args.keys Array of 6 bytes keys.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.data` ({@link Packet}): All sector data. Block data that failed to read will be filled with `0x00`.
     * - `res.success.read` (Array<{@link boolean}>): Indicating whether or not the block read successfully. There are 4 blocks in sector.
     * - `res.success.key` (Array<{@link Packet}, null>): Key A and Key B of all sector. Array may contains `null` if sector key not found.
     */
    async function mfReadCardByKeys ({ sectorMax = 16, keys } = {}) {
      keys = mfKeysUniq(keys)
      if (!keys.length) throw new TypeError('invalid keys')
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        const data = new Packet(sectorMax * 64)
        const success = { key: _.times(sectorMax * 2, () => null), read: _.times(sectorMax * 4, () => 0) }
        for (let i = 0; i < sectorMax; i++) {
          for (let isKb = 0; isKb < 2; isKb++) {
            for (const key of keys) {
              try {
                await mfAuthBlock({ block: i * 4, isKb, key, uid })
                success.key[i * 2 + isKb] = key
                for (let j = 0; j < 4; j++) {
                  try {
                    const block = i * 4 + j
                    if (success.read[block]) continue
                    const blockData = await mfReadBlockHelper(
                      { data: new Packet([0x30, block]), respValidator: mfBlockRespValidator },
                      { block: i * 4, isKb, key, uid },
                    )
                    data.set(blockData, block * 16)
                    success.read[block] = 1
                  } catch (err) {
                    if (!isAdapterOpen()) throw err
                  }
                }
                break
              } catch (err) {
                if (!isAdapterOpen()) throw err
                await pn532.inDeselect({ tg: 1 }).catch(() => {})
              }
            }
          }
          for (let j = 0; j < 2; j++) { // fill key
            if (!success.key[i * 2 + j]) continue
            data.set(success.key[i * 2 + j], i * 64 + [48, 58][j])
          }
        }
        return { data, success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    async function mfWriteBlockHelper (writeOpts, authOpts) {
      await retry(async () => {
        try {
          await pn532.inDataExchange(writeOpts)
        } catch (err) {
          if (!isAdapterOpen()) throw err // rethrow error if adapter is closed
          await pn532.inDeselect({ tg: 1 }).catch(() => {})
          await mfAuthBlock(authOpts).catch(() => {})
          throw new Error(`Failed to write block ${writeOpts?.data?.[1]}`)
        }
      })
    }

    /**
     * Write block data to target by specific key type and key.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be authenticated and write.
     * @param {boolean} args.isKb Type of the key. `0`: key A, `1`: key B.
     * @param {Packet} args.key 6 bytes key to authenticate the block.
     * @param {Packet} args.data 16 bytes block data to write.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfWriteBlock ({ block = 0, isKb = 0, key, data } = {}) {
      if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      isKb = isKb ? 1 : 0
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfAuthBlock({ block, isKb, key, uid })
        await mfWriteBlockHelper(
          { data: new Packet([0xA0, block, ...data]) },
          { block, isKb, key, uid },
        )
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write block data from target by key B and key A.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be authenticated and write.
     * @param {Packet} args.ka 6 bytes Key A of the block.
     * @param {Packet} args.kb 6 bytes Key B of the block.
     * @param {Packet} args.data 16 bytes block data to write.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfWriteBlockKeyBA ({ block = 0, ka, kb, data } = {}) {
      if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
      let isSuccess = false
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        for (let isKb = 1; !isSuccess && isKb >= 0; isKb--) {
          try {
            const key = [ka, kb][isKb]
            await mfAuthBlock({ block, isKb, key, uid })
            await mfWriteBlockHelper(
              { data: new Packet([0xA0, block, ...data]) },
              { block, isKb, key, uid },
            )
            isSuccess = true
          } catch (err) {
            if (!isAdapterOpen()) throw err
            await pn532.inDeselect({ tg: 1 }).catch(() => {})
          }
        }
        if (!isSuccess) throw new Error(`Failed to write block ${block}`)
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Set `uid` of chinese magic card gen2 (aka CUID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {Packet} args.atqa 2 bytes ATQA of target (aka `SENS_RES`).
     * @param {Packet} args.sak 1 byte SAK of target (aka `SEL_RES`).
     * @param {Packet} args.uid 4 bytes uid of target.
     * @param {Packet[]} args.keys Array of 6 bytes keys.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfSetUidGen2 ({ atqa = null, sak = null, uid, keys } = {}) {
      if (!Packet.isLen(uid, 4)) throw new TypeError('invalid 4 bytes uid')
      keys = mfKeysUniq(keys)
      if (!keys.length) throw new TypeError('invalid keys')
      try {
        const oldUid = (await inListPassiveTarget())?.[0]?.uid
        if (!oldUid) throw new Error('Failed to select card')
        const data = Packet.merge(uid, new Packet([uid.xor]), Packet.fromHex('080400000000000000BEAF'))
        if (Packet.isLen(sak, 1)) data.set(sak, 5)
        if (Packet.isLen(atqa, 2)) data.set(atqa.slice().reverse(), 6)
        let isSuccess = false
        for (let i = 1; !isSuccess && i >= 0; i--) {
          for (const key of keys) {
            try {
              await mfAuthBlock({ block: 0, isKb: i, key, uid: oldUid })
              await mfWriteBlockHelper(
                { data: new Packet([0xA0, 0, ...data]) },
                { block: 0, isKb: i, key, uid: oldUid },
              )
              isSuccess = true
              break
            } catch (err) {
              if (!isAdapterOpen()) throw err
              await pn532.inDeselect({ tg: 1 }).catch(() => {})
            }
          }
        }
        if (!isSuccess) throw new Error('Failed to write block 0')
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write sector data to target by specific key type and key.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sector Which sector to be authenticated and write.
     * @param {boolean} args.isKb Type of the key. `0`: key A, `1`: key B.
     * @param {Packet} args.key 6 bytes key to authenticate the sector.
     * @param {Packet} args.data 64 bytes sector data to write.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block write successfully. There are 4 blocks in sector.
     */
    async function mfWriteSector ({ sector = 0, isKb = 0, key, data } = {}) {
      if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
      if (!mfIsValidAcl(data.subarray(54, 57))) throw new TypeError('invalid sector acl')
      if (!Packet.isLen(key, 6)) throw new TypeError('invalid key')
      try {
        let uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfAuthBlock({ block: sector * 4, isKb, key, uid })
        const success = [0, 0, 0, 0]
        for (let i = 0; i < 4; i++) {
          try {
            const block = sector * 4 + i
            await mfWriteBlockHelper(
              { data: new Packet([0xA0, sector * 4 + i, ...data.subarray(i * 16, i * 16 + 16)]) },
              { block: sector * 4, isKb, key, uid },
            )
            success[i] = 1
            if (block === 0) { // if block 0 write successfully, need to read new uid
              await inReleaseIfOpened()
              uid = (await inListPassiveTarget())?.[0]?.uid
              if (!uid) throw new Error('Failed to select card')
            }
          } catch (err) {
            if (!isAdapterOpen()) throw err
          }
        }
        return { success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write sector data to target by key B and key A.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sector Which sector to be authenticated and write.
     * @param {Packet} args.ka 6 bytes Key A of the sector.
     * @param {Packet} args.kb 6 bytes Key B of the sector.
     * @param {Packet} args.data 64 bytes sector data to write.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block write successfully. There are 4 blocks in sector.
     */
    async function mfWriteSectorKeyBA ({ sector = 0, ka, kb, data } = {}) {
      if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
      if (!mfIsValidAcl(data.subarray(54, 57))) throw new TypeError('invalid sector acl')
      try {
        let uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        const success = [0, 0, 0, 0]
        for (let isKb = 1; isKb >= 0; isKb--) {
          try {
            const key = [ka, kb][isKb]
            await mfAuthBlock({ block: sector * 4, isKb, key, uid })
            for (let i = 0; i < 4; i++) {
              try {
                if (success[i]) continue
                const block = sector * 4 + i
                await mfWriteBlockHelper(
                  { data: new Packet([0xA0, block, ...data.subarray(i * 16, i * 16 + 16)]) },
                  { block: sector * 4, isKb, key, uid },
                )
                success[i] = 1
                if (block === 0) { // if block 0 write successfully, need to read new uid
                  await inReleaseIfOpened()
                  uid = (await inListPassiveTarget())?.[0]?.uid
                  if (!uid) throw new Error('Failed to select card')
                }
              } catch (err) {
                if (!isAdapterOpen()) throw err
              }
            }
          } catch (err) {
            if (!isAdapterOpen()) throw err
            await pn532.inDeselect({ tg: 1 }).catch(() => {})
          }
        }
        return { success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write all sector data to target. This function will try to auth sector by `keys`.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sectorMax How many sectors to write to target.
     * @param {Packet[]} args.keys Array of 6 bytes keys.
     * @param {Packet} args.data All sector data to write.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block write successfully. There are 4 blocks in sector.
     */
    async function mfWriteCardByKeys ({ sectorMax = 16, keys, data } = {}) {
      keys = mfKeysUniq(keys)
      if (!keys.length) throw new TypeError('invalid keys')
      if (!Packet.isLen(data, sectorMax * 64)) throw new TypeError('invalid data')
      try {
        let uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        const success = _.times(sectorMax * 4, () => 0)
        for (let i = 0; i < sectorMax; i++) {
          if (!mfIsValidAcl(data.subarray(i * 64 + 54, i * 64 + 57))) continue // invalid sector acl
          let successBlocks = 0
          for (let isKb = 1; successBlocks !== 4 && isKb >= 0; isKb--) {
            for (const key of keys) {
              try {
                await mfAuthBlock({ block: i * 4, isKb, key, uid })
                for (let j = 0; j < 4; j++) {
                  try {
                    const block = i * 4 + j
                    if (success[block]) continue
                    await mfWriteBlockHelper(
                      { data: new Packet([0xA0, block, ...data.subarray(block * 16, block * 16 + 16)]) },
                      { block: i * 4, isKb, key, uid },
                    )
                    success[block] = 1
                    successBlocks++
                    if (block === 0) { // if block 0 write successfully, need to read new uid
                      await inReleaseIfOpened()
                      uid = (await inListPassiveTarget())?.[0]?.uid
                      if (!uid) throw new Error('Failed to select card')
                    }
                  } catch (err) {
                    if (!isAdapterOpen()) throw err
                  }
                }
                break
              } catch (err) {
                if (!isAdapterOpen()) throw err
                await pn532.inDeselect({ tg: 1 }).catch(() => {})
              }
            }
          }
        }
        return { success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    async function mfIdrTransferBlockHelper (data, src, dist) {
      await retry(async () => {
        try {
          await mfAuthBlock(src)
          await pn532.inDataExchange({ data })
          if (src.block !== dist.block && src.isKb === dist.isKb) await mfAuthBlock(dist)
          await pn532.inDataExchange({ data: new Packet([0xB0, dist.block]) })
        } catch (err) {
          if (!isAdapterOpen()) throw err // rethrow error if adapter is closed
          await pn532.inDeselect({ tg: 1 }).catch(() => {})
          const cmdStr = {
            0xA0: 'write',
            0xB0: 'transfer',
            0xC0: 'decrement',
            0xC1: 'increment',
            0xC2: 'restore',
          }[data?.[0]] ?? `cmd(0x${data?.subarray(0, 1)?.hex})`
          throw new Error(`Failed to ${cmdStr} block from ${src.block} to ${dist.block}`)
        }
      })
    }

    /**
     * Increment from value block `src` by `int32` and transfer to `dist` block.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {{ block: number, isKb: boolean, key: Packet }} args.src Which value block to increment from.
     * @param {{ block: number, isKb: boolean, key: Packet }} args.dist Which block to transfer to.
     * @param {number} args.int32 A signed 32-bit integer to increment by.
     * @returns {Promise<null>} Resolve after finished.
     * @see {@link https://www.nxp.com/docs/en/data-sheet/MF1S50YYX_V1.pdf|MF1S50YYX_V1 P.9}
     */
    async function mfIncrementBlock ({ src, dist, int32 = 0 } = {}) {
      for (const [k, v] of [['src', src], ['dist', dist]]) {
        if (!Packet.isLen(v?.key, 6)) throw new TypeError(`invalid ${k}.key`)
        v.isKb = v?.isKb ? 1 : 0
        v.block = v?.block ?? 0
      }
      const data = new Packet([0xC1, src.block, 0, 0, 0, 0])
      data.setInt32(2, int32)
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfIdrTransferBlockHelper(data, { ...src, uid }, { ...dist, uid })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Decrement from value block `src` by `int32` and transfer to `dist` block.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {{ block: number, isKb: boolean, key: Packet }} args.src Which value block to decrement from.
     * @param {{ block: number, isKb: boolean, key: Packet }} args.dist Which block to transfer to.
     * @param {number} args.int32 A signed 32-bit integer to decrement by.
     * @returns {Promise<null>} Resolve after finished.
     * @see {@link https://www.nxp.com/docs/en/data-sheet/MF1S50YYX_V1.pdf|MF1S50YYX_V1 P.9}
     */
    async function mfDecrementBlock ({ src, dist, int32 = 0 } = {}) {
      for (const [k, v] of [['src', src], ['dist', dist]]) {
        if (!Packet.isLen(v?.key, 6)) throw new TypeError(`invalid ${k}.key`)
        v.isKb = v?.isKb ? 1 : 0
        v.block = v?.block ?? 0
      }
      const data = new Packet([0xC0, src.block, 0, 0, 0, 0])
      data.setInt32(2, int32)
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfIdrTransferBlockHelper(data, { ...src, uid }, { ...dist, uid })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Copy from value block `src` and transfer to `dist` block.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {{ block: number, isKb: boolean, key: Packet }} args.src Which value block to copy from.
     * @param {{ block: number, isKb: boolean, key: Packet }} args.dist Which block to transfer to.
     * @returns {Promise<null>} Resolve after finished.
     * @see {@link https://www.nxp.com/docs/en/data-sheet/MF1S50YYX_V1.pdf|MF1S50YYX_V1 P.9}
     */
    async function mfRestoreBlock ({ src, dist } = {}) {
      for (const [k, v] of [['src', src], ['dist', dist]]) {
        if (!Packet.isLen(v?.key, 6)) throw new TypeError(`invalid ${k}.key`)
        v.isKb = v?.isKb ? 1 : 0
        v.block = v?.block ?? 0
      }
      const data = new Packet([0xC2, src.block, 0, 0, 0, 0])
      try {
        const uid = (await inListPassiveTarget())?.[0]?.uid
        if (!uid) throw new Error('Failed to select card')
        await mfIdrTransferBlockHelper(data, { ...src, uid }, { ...dist, uid })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Send backdoor command of chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfBackdoorGen1a () {
      try {
        // writeRegisters
        // 0x6302 CIU_TxMode bit7 TxCRCEn
        // 0x6303 CIU_RxMode bit7 RxCRCEn
        // 0x633D CIU_BitFraming TxLastBits
        await inListPassiveTarget()
        await pn532.inSelect({ tg: 1 })
        await pn532.writeRegisters({ 0x6302: 0x00, 0x6303: 0x00 })
        await pn532.inCommunicateThru({ data: new Packet([0x50, 0x00, 0x57, 0xCD]) }).catch(() => {})
        await pn532.writeRegisters({ 0x633D: 0x07 })
        await pn532.inCommunicateThru({ data: new Packet([0x40]) })
        await pn532.writeRegisters({ 0x633D: 0x00 })
        await pn532.inCommunicateThru({ data: new Packet([0x43]) })
      } catch (err) {
        if (!isAdapterOpen()) throw err // rethrow error if adapter is closed
        throw new Error('Failed to open backdoor')
      } finally {
        if (isAdapterOpen()) await pn532.writeRegisters({ 0x6302: 0x80, 0x6303: 0x80 })
      }
    }

    async function mfReadBlockGen1aHelper (readOpts) {
      const resp = await retry(async () => {
        try {
          return await pn532.inDataExchange(readOpts)
        } catch (err) {
          await inReleaseIfOpened()
          await mfBackdoorGen1a().catch(() => {})
          throw new Error(`Failed to read block ${readOpts?.data?.[1]}`)
        }
      })
      return resp?.data
    }

    /**
     * Read block data from chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be read.
     * @returns {Promise<Packet>} Resolve with 16 bytes block data.
     */
    async function mfReadBlockGen1a ({ block = 0 } = {}) {
      try {
        await mfBackdoorGen1a()
        return await mfReadBlockGen1aHelper({ data: new Packet([0x30, block]), respValidator: mfBlockRespValidator })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Read sector data from chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sector Which sector to be read.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.data` ({@link Packet}): 64 bytes sector data. Block data that failed to read will be filled with `0x00`.
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block read successfully. There are 4 blocks in sector.
     */
    async function mfReadSectorGen1a ({ sector = 0 } = {}) {
      try {
        await mfBackdoorGen1a()
        const data = new Packet(64)
        const success = [0, 0, 0, 0]
        for (let i = 0; i < 4; i++) {
          try {
            const block = sector * 4 + i
            const blockData = await mfReadBlockGen1aHelper({ data: new Packet([0x30, block]), respValidator: mfBlockRespValidator })
            data.set(blockData, i * 16)
            success[i] = 1
          } catch (err) {
            if (!isAdapterOpen()) throw err
          }
        }
        return { data, success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Read all sector data from chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sectorMax How many sectors to read from target.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.data` ({@link Packet}): All sector data. Block data that failed to read will be filled with `0x00`.
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block read successfully. There are 4 blocks in sector.
     */
    async function mfReadCardGen1a ({ sectorMax = 16 } = {}) {
      try {
        await mfBackdoorGen1a()
        const data = new Packet(sectorMax * 64)
        const success = _.times(sectorMax * 4, () => 0)
        for (let i = 0; i < sectorMax; i++) {
          for (let j = 0; j < 4; j++) {
            try {
              const block = i * 4 + j
              const blockData = await mfReadBlockGen1aHelper({ data: new Packet([0x30, block]), respValidator: mfBlockRespValidator })
              data.set(blockData, block * 16)
              success[block] = 1
            } catch (err) {
              if (!isAdapterOpen()) throw err
            }
          }
        }
        return { data, success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    async function mfWriteBlockGen1aHelper (writeOpts) {
      await retry(async () => {
        try {
          await pn532.inDataExchange(writeOpts)
        } catch (err) {
          await inReleaseIfOpened()
          await mfBackdoorGen1a().catch(() => {})
          throw new Error(`Failed to write block ${writeOpts?.data?.[1]}`)
        }
      })
    }

    /**
     * Write block data to chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.block Which block to be write.
     * @param {Packet} args.data 16 bytes block data to write.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfWriteBlockGen1a ({ block = 0, data } = {}) {
      if (!Packet.isLen(data, 16)) throw new TypeError('invalid data')
      try {
        await mfBackdoorGen1a()
        await mfWriteBlockGen1aHelper({ data: new Packet([0xA0, block, ...data]) })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write sector data to chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sector Which sector to be read.
     * @param {Packet} args.data 64 bytes sector data to write.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block write successfully. There are 4 blocks in sector.
     */
    async function mfWriteSectorGen1a ({ sector = 0, data } = {}) {
      if (!Packet.isLen(data, 64)) throw new TypeError('invalid data')
      if (!mfIsValidAcl(data.subarray(54, 57))) throw new TypeError('invalid sector acl')
      try {
        await mfBackdoorGen1a()
        const success = [0, 0, 0, 0]
        for (let i = 0; i < 4; i++) {
          try {
            const block = sector * 4 + i
            await mfWriteBlockGen1aHelper({ data: new Packet([0xA0, block, ...data.subarray(i * 16, i * 16 + 16)]) })
            success[i] = 1
          } catch (err) {
            if (!isAdapterOpen()) throw err
          }
        }
        return { success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write all sector data to chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.sectorMax How many sectors to write to target.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block write successfully. There are 4 blocks in sector.
     */
    async function mfWriteCardGen1a ({ sectorMax = 16, data } = {}) {
      if (!Packet.isLen(data, sectorMax * 64)) throw new TypeError('invalid data')
      try {
        await mfBackdoorGen1a()
        const success = _.times(sectorMax * 4, () => 0)
        for (let i = 0; i < sectorMax; i++) {
          for (let j = 0; j < 4; j++) {
            try {
              const block = i * 4 + j
              await mfWriteBlockGen1aHelper({ data: new Packet([0xA0, block, ...data.subarray(block * 16, block * 16 + 16)]) })
              success[block] = 1
            } catch (err) {
              if (!isAdapterOpen()) throw err
            }
          }
        }
        return { success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Set `uid` of chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {Packet} args.atqa 2 bytes ATQA of target (aka `SENS_RES`).
     * @param {Packet} args.sak 1 byte SAK of target (aka `SEL_RES`).
     * @param {Packet} args.uid 4 bytes uid of target.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfSetUidGen1a ({ atqa = null, sak = null, uid } = {}) {
      if (!Packet.isLen(uid, 4)) throw new TypeError('invalid 4 bytes uid')
      const data = Packet.merge(uid, new Packet([uid.xor]), Packet.fromHex('080400000000000000BEAF'))
      if (Packet.isLen(sak, 1)) data.set(sak, 5)
      if (Packet.isLen(atqa, 2)) data.set(atqa.slice().reverse(), 6)
      await mfWriteBlockGen1a({ block: 0, data })
    }

    /**
     * Wipe all sector data of chinese magic card gen1a (aka UID).
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {Packet} args.atqa 2 bytes ATQA of target (aka `SENS_RES`).
     * @param {Packet} args.sak 1 byte SAK of target (aka `SEL_RES`).
     * @param {Packet} args.uid 4 bytes uid of target.
     * @returns {Promise<object>} Resolve with `res`:
     * - `res.success` (Array<{@link boolean}>): Indicating whether or not the block wipe successfully. There are 4 blocks in sector.
     */
    async function mfWipeGen1a ({ sectorMax = 16, atqa = null, sak = null, uid } = {}) {
      try {
        if (!Packet.isLen(uid, 4)) throw new TypeError('invalid 4 bytes uid')
        const success = _.times(sectorMax * 4, () => 0)
        await mfBackdoorGen1a()

        // block 0
        try {
          const data = Packet.merge(uid, Packet.fromHex('00080400000000000000BEAF'))
          for (const b of uid) data[4] ^= b // bcc
          if (Packet.isLen(sak, 1)) data.set(sak, 5)
          if (Packet.isLen(atqa, 2)) data.set(atqa, 6)
          await mfWriteBlockGen1aHelper({ data: new Packet([0xA0, 0, ...data]) })
          success[0] = 1
        } catch (err) {
          if (!isAdapterOpen()) throw err
        }

        // other block
        const emptyData = Packet.fromHex('00000000000000000000000000000000')
        const keyData = Packet.fromHex('FFFFFFFFFFFF08778F00FFFFFFFFFFFF')
        for (let i = 0; i < sectorMax; i++) {
          for (let j = (i ? 0 : 1); j < 3; j++) {
            try {
              await mfWriteBlockGen1aHelper({ data: new Packet([0xA0, i * 4 + j, ...emptyData]) })
              success[i * 4 + j] = 1
            } catch (err) {
              if (!isAdapterOpen()) throw err
            }
          }
          try {
            await mfWriteBlockGen1aHelper({ data: new Packet([0xA0, i * 4 + 3, ...keyData]) })
            success[i * 4 + 3] = 1
          } catch (err) {
            if (!isAdapterOpen()) throw err
          }
        }
        return { success }
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * NDEF URI Record prefix abbreviations, the array index is the URI Identifier Code.
     * Compressing a well known prefix into a single byte saves precious tag memory.
     * @see NFC Forum URI Record Type Definition (RTD-URI)
     */
    const NDEF_URI_PREFIXES = [
      '', // 0x00
      'http://www.', // 0x01
      'https://www.', // 0x02
      'http://', // 0x03
      'https://', // 0x04
      'tel:', // 0x05
      'mailto:', // 0x06
      'ftp://anonymous:anonymous@', // 0x07
      'ftp://ftp.', // 0x08
      'ftps://', // 0x09
      'sftp://', // 0x0A
      'smb://', // 0x0B
      'nfs://', // 0x0C
      'ftp://', // 0x0D
      'dav://', // 0x0E
      'news:', // 0x0F
      'telnet://', // 0x10
      'imap:', // 0x11
      'rtsp://', // 0x12
      'urn:', // 0x13
      'pop:', // 0x14
      'sip:', // 0x15
      'sips:', // 0x16
      'tftp:', // 0x17
      'btspp://', // 0x18
      'btl2cap://', // 0x19
      'btgoep://', // 0x1A
      'tcpobex://', // 0x1B
      'irdaobex://', // 0x1C
      'file://', // 0x1D
      'urn:epc:id:', // 0x1E
      'urn:epc:tag:', // 0x1F
      'urn:epc:pat:', // 0x20
      'urn:epc:raw:', // 0x21
      'urn:epc:', // 0x22
      'urn:nfc:', // 0x23
    ]

    /** The first page of the user memory of NTAG / MIFARE Ultralight. */
    const ULTRALIGHT_USER_PAGE = 4

    /**
     * The layout of the tag, indexed by the product type byte (byte 2) and then the storage
     * size byte (byte 6) of the `GET_VERSION` response.
     *
     * `GET_VERSION` is used instead of the Capability Container because the CC of NTAG215 /
     * NTAG216 understates the data area by 8 / 16 bytes, and because the CC is writable and
     * therefore not a trustworthy bound. The storage size byte only encodes a `2^n` ~ `2^(n+1)`
     * range, so a lookup table is the only way to get the real size, and it does not tell NTAG
     * apart from MIFARE Ultralight EV1 either: NTAG212 and MF0UL21 both report `0x0E`. The
     * product type byte is what separates them.
     *
     * Only products whose `userMemory` and `dynamicLockPage` could be cross checked against a
     * second source are listed. Anything else falls back to `ULTRALIGHT_FALLBACK_CAPACITY`,
     * which is also the correct size for the 48 bytes products (NTAG210, MF0UL11), so leaving
     * them out costs nothing but the product name. Being absent from this table is always the
     * safe direction: it can refuse a write that would have fit, never allow one that does not.
     *
     * `dynamicLockPage` is derived from the NDEF Lock Control TLV values that NXP ships in the
     * factory state of these tags, which encode the byte address of the lock area:
     * NTAG212 `90 0A 34` -> byte 144 -> page 36, NTAG213 `A0 0C 34` -> byte 160 -> page 40,
     * NTAG215 `88 08 66` -> byte 520 -> page 130, NTAG216 `E8 0E 66` -> byte 904 -> page 226.
     * The lock bit counts in the same TLVs also confirm the user memory of NTAG212
     * (10 bits x 8 bytes + 48 = 128) and NTAG213 (12 bits x 8 bytes + 48 = 144).
     * @see https://github.com/adafruit/Adafruit-PN532/issues/34
     *
     * Confirmed on hardware for NTAG213, NTAG215, NTAG216 and MF0UL21: reading
     * `dynamicLockPage` returns `00 00 00 BD` on all of them, where `BD` is the factory RFUI
     * byte of the dynamic lock page, and the three pages after it read back as CFG0
     * (`04 00 00 FF`, `00 00 00 FF` on MF0UL21), CFG1 (`00 05 00 00`) and PWD (`00 00 00 00`).
     * That is the whole trailing block, so the user memory really does end on the page before.
     * The Capability Container of the same cards reports 872 for NTAG216 and 496 for NTAG215,
     * 16 and 8 bytes short of the sizes below, exactly as the issue above describes.
     */
    const ULTRALIGHT_PRODUCTS = {
      0x03: { // MIFARE Ultralight EV1
        0x0E: { product: 'MIFARE Ultralight EV1 (MF0UL21)', userMemory: 128, dynamicLockPage: 36 },
      },
      0x04: { // NTAG
        0x0E: { product: 'NTAG212', userMemory: 128, dynamicLockPage: 36 },
        0x0F: { product: 'NTAG213', userMemory: 144, dynamicLockPage: 40 },
        0x11: { product: 'NTAG215', userMemory: 504, dynamicLockPage: 130 },
        0x13: { product: 'NTAG216', userMemory: 888, dynamicLockPage: 226 },
      },
    }

    /**
     * The size of the user memory to assume when the tag is not in `ULTRALIGHT_PRODUCTS`,
     * either because it does not support `GET_VERSION` or because it is a product we have no
     * confirmed layout for.
     *
     * 48 bytes is page 4 ~ 15, the region that is data area on *every* NFC Forum Type 2 tag:
     * the static lock bytes in page 2 lock exactly page 3 ~ 15, so no tag can put its lock or
     * configuration pages below page 16. Writing within it can therefore never hit a one time
     * programmable page, whatever the tag turns out to be.
     *
     * A tag with more memory than this just gets refused a write that would have fit. Pass
     * `capacity` explicitly to use the whole card, e.g. `capacity: 144` for MIFARE Ultralight C.
     */
    const ULTRALIGHT_FALLBACK_CAPACITY = 48

    function ultralightAssertPage (page) {
      if (!_.isSafeInteger(page) || page < 0 || page > 0xFF) throw new TypeError('invalid page, expected an integer between 0 and 255')
      return page
    }

    /**
     * Read a page from NTAG / MIFARE Ultralight.
     * The MIFARE Ultralight READ command returns 4 consecutive pages (16 bytes)
     * starting from the specified page address.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.page Target page address (`0x00` ~ `0xFF`).
     * @param {number} args.tg Logical number of the relevant target.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Packet>} Resolve with 16 bytes (4 pages starting from the target page).
     */
    async function mfUltralightReadPage ({ page = 0, tg = 1, timeout } = {}) {
      ultralightAssertPage(page)
      const resp = await retry(async () => {
        try {
          return await pn532.inDataExchange({
            tg,
            data: new Packet([0x30, page]),
            timeout,
          })
        } catch (err) {
          if (!isAdapterOpen()) throw err
          throw new Error(`Failed to read page ${page}`)
        }
      })
      return resp?.data
    }

    /**
     * Read a page from NTAG / MIFARE Ultralight with card selection and release.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.page Target page address (`0x00` ~ `0xFF`).
     * @param {number} args.timeout The maxinum timeout for waiting response, applied to both card selection and the READ command.
     * @returns {Promise<Packet>} Resolve with 16 bytes.
     */
    async function mfUltralightReadPageWrapped ({ page = 0, timeout } = {}) {
      ultralightAssertPage(page)
      try {
        const target = (await inListPassiveTarget({ timeout }))?.[0]
        if (!target) throw new Error('Failed to select card')
        return await mfUltralightReadPage({ page, timeout })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Write 4 bytes data to a single page of NTAG / MIFARE Ultralight.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.page Target page address (`0x00` ~ `0xFF`).
     * @param {Packet} args.data 4 bytes page data to write.
     * @param {number} args.tg Logical number of the relevant target.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @param {boolean} args.verify Read the page back and compare it after writing. The WRITE command is only acknowledged, the tag never echoes what it stored.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfUltralightWritePage ({ page = 0, data, tg = 1, timeout, verify = false } = {}) {
      ultralightAssertPage(page)
      if (!Packet.isLen(data, 4)) throw new TypeError('invalid data, expected 4 bytes')
      await retry(async () => {
        try {
          await pn532.inDataExchange({
            tg,
            data: new Packet([0xA2, page, ...data]),
            timeout,
          })
        } catch (err) {
          if (!isAdapterOpen()) throw err
          throw new Error(`Failed to write page ${page}`)
        }
      })
      if (verify) await ultralightVerifyPages({ page, data, tg, timeout })
    }

    /**
     * Read pages back and compare them with the data that should have been written.
     * @param {object} args
     * @param {number} args.page The first page to compare.
     * @param {Packet} args.data The data that should have been written, a multiple of 4 bytes.
     * @param {number} args.tg Logical number of the relevant target.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<null>} Resolve if every byte matches.
     */
    async function ultralightVerifyPages ({ page = 0, data, tg = 1, timeout } = {}) {
      // one READ returns 4 pages, so a whole NDEF message costs a quarter of the round trips
      for (let i = 0; i < data.length; i += 16) {
        const expected = data.subarray(i, i + 16)
        const actual = (await mfUltralightReadPage({ page: page + (i / 4), tg, timeout }))?.subarray(0, expected.length)
        if (!Packet.isLen(actual, expected.length) || actual.hex !== expected.hex) {
          throw new Error(`Failed to verify page ${page + (i / 4)}, expected ${expected.hex} but read ${actual?.hex}`)
        }
      }
    }

    /**
     * Write 4 bytes data to a single page of NTAG / MIFARE Ultralight with card selection and release.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.page Target page address (`0x00` ~ `0xFF`).
     * @param {Packet} args.data 4 bytes page data to write.
     * @param {number} args.timeout The maxinum timeout for waiting response, applied to both card selection and the WRITE command.
     * @param {boolean} args.verify Read the page back and compare it after writing.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfUltralightWritePageWrapped ({ page = 0, data, timeout, verify = false } = {}) {
      ultralightAssertPage(page)
      try {
        const target = (await inListPassiveTarget({ timeout }))?.[0]
        if (!target) throw new Error('Failed to select card')
        await mfUltralightWritePage({ page, data, timeout, verify })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Encode an URI into the bytes that can be written to NTAG / MIFARE Ultralight starting from page 4.
     *
     * ```
     * TLV:    0x03 [length] [NDEF message] 0xFE
     * Record: [header] 0x01 [payload length] 0x55 [URI identifier code] [URI]
     * ```
     * @param {string} uri The URI to encode.
     * @returns {Packet} The NDEF message wrapped in a TLV and zero padded to a multiple of 4 bytes.
     */
    function ultralightEncodeNdefUri (uri) {
      if (!_.isString(uri) || uri.length < 1) throw new TypeError('invalid uri')

      // Match the longest prefix instead of the first one that matches, otherwise
      // `https://www.` would be shortened by `https://` and waste 4 bytes.
      let prefixCode = 0x00
      let prefixLen = 0
      for (let i = 1; i < NDEF_URI_PREFIXES.length; i++) {
        const prefix = NDEF_URI_PREFIXES[i]
        if (prefix.length <= prefixLen || !_.startsWith(uri, prefix)) continue
        prefixCode = i
        prefixLen = prefix.length
      }

      const uriBytes = Packet.fromUtf8(uri.slice(prefixLen))
      const payloadLen = 1 + uriBytes.length // 1 byte URI identifier code + URI

      // A short record (SR = 1) only has a 1 byte payload length field. A longer payload
      // must be encoded as a normal record (SR = 0) with a 4 bytes big-endian length,
      // otherwise the length would silently overflow and corrupt the NDEF message.
      const ndef = payloadLen < 0x100
        ? new Packet([
          0xD1, // MB=1, ME=1, CF=0, SR=1, IL=0, TNF=1
          0x01, // Type Length
          payloadLen, // Payload Length
          0x55, // Type 'U'
          prefixCode,
          ...uriBytes,
        ])
        : new Packet([
          0xC1, // MB=1, ME=1, CF=0, SR=0, IL=0, TNF=1
          0x01, // Type Length
          (payloadLen >>> 24) & 0xFF, // Payload Length
          (payloadLen >>> 16) & 0xFF,
          (payloadLen >>> 8) & 0xFF,
          payloadLen & 0xFF,
          0x55, // Type 'U'
          prefixCode,
          ...uriBytes,
        ])

      // 0xFF is the escape value of the TLV length field, a length of 255 or more must be
      // encoded in the following 2 bytes big-endian.
      const tlv = ndef.length < 0xFF
        ? new Packet([0x03, ndef.length, ...ndef, 0xFE])
        : new Packet([0x03, 0xFF, (ndef.length >>> 8) & 0xFF, ndef.length & 0xFF, ...ndef, 0xFE])

      const data = new Packet(Math.ceil(tlv.length / 4) * 4)
      data.set(tlv)
      return data
    }

    /**
     * @typedef {object} Pn532Hf14a~UltralightVersion
     * @property {Packet} pack raw 8 bytes of the `GET_VERSION` response.
     * @property {number} vendorId `0x04` for NXP.
     * @property {number} productType `0x03` for MIFARE Ultralight, `0x04` for NTAG.
     * @property {number} productSubtype
     * @property {number} majorVersion
     * @property {number} minorVersion
     * @property {number} storageSize The raw storage size byte. It only encodes a `2^n` ~ `2^(n+1)` range, so it has to be looked up rather than calculated.
     * @property {number} protocolType `0x03` for ISO/IEC 14443-3.
     * @property {?string} product Product name of the tag, `null` if the product type and the storage size are not a known combination.
     * @property {?number} userMemory Size in bytes of the user memory, `null` if the product is not a known one.
     * @property {?number} lastPage The last page of the user memory, `null` if the product is not a known one.
     * @property {?number} dynamicLockPage The page holding the dynamic lock bits, `null` if the product is not a known one or has no dynamic lock bits at all. The pages from here on are one time programmable or hold the password.
     */

    /**
     * Identify a NTAG / MIFARE Ultralight tag with the `GET_VERSION` command.
     *
     * This is the only reliable way to know how big the tag actually is. The Capability
     * Container is not: it is writable, and the factory value of NTAG215 / NTAG216
     * understates the data area by 8 / 16 bytes.
     *
     * `GET_VERSION` is not a MIFARE Classic command, so it is sent through
     * `InCommunicateThru` instead of `InDataExchange`. A tag that does not implement it
     * (e.g. the original MIFARE Ultralight) answers with a NAK **and then goes idle**, so
     * the card has to be selected again before sending anything else.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<Pn532Hf14a~UltralightVersion>} Resolve with the parsed version of the tag.
     */
    async function mfUltralightGetVersion ({ timeout } = {}) {
      const { data: pack } = await pn532.inCommunicateThru({ data: new Packet([0x60]), timeout })
      // 00 04 04 02 01 00 0F 03 = NTAG213
      if (!Packet.isLen(pack, 8)) throw new Error(`Failed to get version, expected 8 bytes but got ${pack?.length}`)
      const [productType, storageSize] = [pack[2], pack[6]]
      // the storage size alone does not tell NTAG210 from MF0UL11, nor NTAG212 from MF0UL21
      const { product = null, userMemory = null, dynamicLockPage = null } = ULTRALIGHT_PRODUCTS[productType]?.[storageSize] ?? {}
      return {
        pack,
        vendorId: pack[1],
        productType,
        productSubtype: pack[3],
        majorVersion: pack[4],
        minorVersion: pack[5],
        storageSize,
        protocolType: pack[7],
        product,
        userMemory,
        lastPage: _.isNil(userMemory) ? null : ULTRALIGHT_USER_PAGE - 1 + (userMemory / 4),
        dynamicLockPage,
      }
    }

    /**
     * Identify a NTAG / MIFARE Ultralight tag with card selection and release.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {number} args.timeout The maxinum timeout for waiting response, applied to both card selection and the `GET_VERSION` command.
     * @returns {Promise<Pn532Hf14a~UltralightVersion>} Resolve with the parsed version of the tag.
     */
    async function mfUltralightGetVersionWrapped ({ timeout } = {}) {
      try {
        const target = (await inListPassiveTarget({ timeout }))?.[0]
        if (!target) throw new Error('Failed to select card')
        return await mfUltralightGetVersion({ timeout })
      } finally {
        await inReleaseIfOpened()
      }
    }

    /**
     * Throw if the pages that are about to be written can not actually be written: a lock bit
     * already covers them, or the tag asks for a password. Both fail silently at the tag level
     * and would otherwise surface as a bare write error halfway through the message.
     * @param {object} args
     * @param {number} args.lastWritePage The last page that is going to be written.
     * @param {?number} args.dynamicLockPage The page holding the dynamic lock bits, `null` when the layout of the tag is not known. Only pass one that came from `GET_VERSION`, the pages after it are read as CFG0 / CFG1.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @returns {Promise<null>} Resolve if every page that is about to be written can be written.
     */
    async function ultralightAssertWritable ({ lastWritePage, dynamicLockPage, timeout } = {}) {
      // page 2 is [BCC1, Internal, LOCK0, LOCK1]. LOCK0 bit 4~7 lock page 4~7,
      // LOCK1 bit 0~7 lock page 8~15, the lower bits of LOCK0 lock page 3 and the block-locks.
      const staticLock = (await mfUltralightReadPage({ page: 2, timeout }))?.subarray(2, 4)
      if (!Packet.isLen(staticLock, 2)) throw new Error('Failed to read the static lock bytes')
      if ((staticLock[0] & 0xF0) !== 0 || staticLock[1] !== 0) {
        throw new Error(`Some of page 4 ~ 15 are locked by the static lock bytes ${staticLock.hex}, they are one time programmable and can not be unlocked`)
      }
      if (_.isNil(dynamicLockPage)) return

      // one READ covers the dynamic lock page, CFG0, CFG1 and PWD in a single round trip
      const cfg = await mfUltralightReadPage({ page: dynamicLockPage, timeout })
      if (!Packet.isLen(cfg, 16)) throw new Error('Failed to read the configuration pages')

      const dynamicLock = cfg.subarray(0, 3)
      if (lastWritePage > 15 && dynamicLock.hex !== '000000') { // they only cover page 16 and above
        throw new Error(`Some of page 16 ~ ${dynamicLockPage - 1} are locked by the dynamic lock bytes ${dynamicLock.hex}, they are one time programmable and can not be unlocked`)
      }

      // CFG0 is [MIRROR, RFUI, MIRROR_PAGE, AUTH0], AUTH0 is the first page that needs a
      // password. CFG1 is [ACCESS, RFUI, RFUI, RFUI], ACCESS bit 7 is PROT.
      const auth0 = cfg[7]
      if (auth0 <= lastWritePage) {
        const scope = (cfg[8] & 0x80) !== 0 ? 'reading and writing' : 'writing'
        throw new Error(`The tag needs a password for ${scope} from page ${auth0} (AUTH0 = ${cfg.subarray(7, 8).hex}), authenticate with PWD_AUTH before writing`)
      }
    }

    /**
     * Write an NDEF URI to NTAG / MIFARE Ultralight, starting from page 4.
     *
     * The write is bounded by the user memory of the tag so that it can never run into the
     * dynamic lock bits and the configuration pages, which are one time programmable and
     * would brick the tag. Note that this is the physical bound: a phone only reads up to
     * the size declared by the Capability Container, which is 8 / 16 bytes smaller on
     * NTAG215 / NTAG216. Pass `capacity` if you want to honour that instead.
     * @memberof Pn532Hf14a
     * @instance
     * @async
     * @param {object} args
     * @param {string} args.uri The URI to write (e.g. `https://example.com`).
     * @param {number} args.capacity The size in bytes of the user memory of the tag. Default to the size reported by `GET_VERSION`, or 48 bytes for a tag that does not support it.
     * @param {number} args.timeout The maxinum timeout for waiting response.
     * @param {boolean} args.verify Read the message back and compare it after writing.
     * @returns {Promise<null>} Resolve after finished.
     */
    async function mfUltralightWriteNdefUri ({ uri = '', capacity, timeout, verify = true } = {}) {
      const data = ultralightEncodeNdefUri(uri)
      try {
        let target = (await inListPassiveTarget({ timeout }))?.[0]
        if (!target) throw new Error('Failed to select card')

        // The pages right after the user memory hold the dynamic lock bits and the
        // configuration pages, both of which are one time programmable and can brick the
        // tag permanently. Never write more pages than the tag actually has.
        let dynamicLockPage = null
        if (_.isNil(capacity)) {
          const version = await mfUltralightGetVersion({ timeout }).catch(err => {
            if (!isAdapterOpen()) throw err
            return null
          })
          ;({ userMemory: capacity = null, dynamicLockPage } = version ?? {})
          if (_.isNil(capacity)) { // the NAK of an unsupported GET_VERSION also halts the tag
            capacity = ULTRALIGHT_FALLBACK_CAPACITY
            await inReleaseIfOpened()
            target = (await inListPassiveTarget({ timeout }))?.[0]
            if (!target) throw new Error('Failed to select card')
          }
        }
        // `dynamicLockPage` is deliberately left null for an explicit `capacity`: guessing it
        // from the size would read the wrong pages as CFG0 / CFG1 on a tag whose layout differs
        // (MIFARE Ultralight C keeps a counter where NTAG21x keeps CFG0), and an explicit
        // capacity means the caller has taken responsibility for the layout anyway.
        if (data.length > capacity) throw new Error(`NDEF message is ${data.length} bytes, exceed the ${capacity} bytes user memory of the tag`)

        const lastWritePage = ULTRALIGHT_USER_PAGE - 1 + (data.length / 4)
        await ultralightAssertWritable({ lastWritePage, dynamicLockPage, timeout })

        for (let i = 0; i < data.length; i += 4) {
          await mfUltralightWritePage({ page: ULTRALIGHT_USER_PAGE + (i / 4), data: data.subarray(i, i + 4), timeout })
        }
        if (verify) await ultralightVerifyPages({ page: ULTRALIGHT_USER_PAGE, data, timeout })
      } finally {
        await inReleaseIfOpened()
      }
    }

    return {
      inListPassiveTarget,
      mfAuthBlock,
      mfBackdoorGen1a,
      mfCheckKeys,
      mfDecrementBlock,
      mfIncrementBlock,
      mfKeysUniq,
      mfReadBlock,
      mfReadBlockGen1a,
      mfReadBlockKeyBA,
      mfReadCardByKeys,
      mfReadCardGen1a,
      mfReadSector,
      mfReadSectorGen1a,
      mfReadSectorKeyBA,
      mfRestoreBlock,
      mfSelectCard,
      mfSetUidGen1a,
      mfSetUidGen2,
      mfUltralightGetVersion,
      mfUltralightGetVersionWrapped,
      mfUltralightReadPage,
      mfUltralightReadPageWrapped,
      mfUltralightWriteNdefUri,
      mfUltralightWritePage,
      mfUltralightWritePageWrapped,
      mfWipeGen1a,
      mfWriteBlock,
      mfWriteBlockGen1a,
      mfWriteBlockKeyBA,
      mfWriteCardByKeys,
      mfWriteCardGen1a,
      mfWriteSector,
      mfWriteSectorGen1a,
      mfWriteSectorKeyBA,
      testIso14443Part4Present,
    }
  }
}
