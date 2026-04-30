// Generates minimal valid PNG assets for Expo build
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

function createPNG(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137,80,78,71,13,10,26,10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const ihdrChunk = makeChunk('IHDR', ihdr)

  // Raw image data: each row = filter byte (0) + RGB pixels
  const row = Buffer.alloc(1 + width * 3)
  row[0] = 0  // filter none
  for (let x = 0; x < width; x++) {
    row[1 + x*3]   = r
    row[1 + x*3+1] = g
    row[1 + x*3+2] = b
  }
  const rawData = Buffer.concat(Array(height).fill(row))
  const compressed = zlib.deflateSync(rawData)
  const idatChunk = makeChunk('IDAT', compressed)

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk])
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crc = crc32(Buffer.concat([typeB, data]))
  const crcB = Buffer.alloc(4)
  crcB.writeUInt32BE(crc >>> 0)
  return Buffer.concat([len, typeB, data, crcB])
}

function crc32(buf) {
  const table = makeCRCTable()
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xFF]
  return (c ^ 0xFFFFFFFF)
}

let _crcTable = null
function makeCRCTable() {
  if (_crcTable) return _crcTable
  _crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    _crcTable[n] = c
  }
  return _crcTable
}

const assetsDir = path.join(__dirname, '..', 'assets')

// Primary blue color of the app
const [R, G, B] = [37, 99, 235]  // #2563eb (primary-600)

const assets = [
  { file: 'icon.png',          w: 1024, h: 1024, r: R, g: G, b: B },
  { file: 'adaptive-icon.png', w: 1024, h: 1024, r: R, g: G, b: B },
  { file: 'splash.png',        w: 1284, h: 2778, r: 255, g: 255, b: 255 },
  { file: 'favicon.png',       w: 196,  h: 196,  r: R, g: G, b: B },
]

for (const { file, w, h, r, g, b } of assets) {
  const buf = createPNG(w, h, r, g, b)
  const dest = path.join(assetsDir, file)
  fs.writeFileSync(dest, buf)
  console.log(`✓ ${file} (${w}×${h}) — ${buf.length} bytes`)
}
console.log('\nAssets generated. Run: eas build -p android --profile preview')
