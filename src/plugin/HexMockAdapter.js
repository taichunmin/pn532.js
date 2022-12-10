export default class HexMockAdapter {
  name = 'adapter'
  rxHex = []
  txHex = []

  install (context, pluginOption) {
    const { pn532, Packet } = context

    if (pn532.$adapter) throw new Error('adapter already exists')

    pn532.tx = new TransformStream()
    pn532.tx.readable.pipeTo(new WritableStream({ // no wait
      write: pack => { this.txHex.push(pack.hex) },
    }))

    pn532.addMiddleware('writePacket', async (ctx, next) => {
      await next()
      const resp = this.rxHex.shift()
      if (!resp?.length) return
      const writer = pn532.rx.writable.getWriter()
      await writer.write(Packet.fromHex(resp))
      writer.releaseLock()
    })

    return {
      connect () {},
      disconnect () {},
      isOpen () { return true },
      isSupport () {},
    }
  }
}
