var zlib = require('zlib')
var xml = require('xml2js')
var crypto = require('crypto')

module.exports = getToc

function getToc (data, cb) {
  if (data.slice(0, 4).toString() !== 'xar!') {
    return cb(new Error('Not a xar file'))
  }

  var header = {}
  header.size = data.readUInt16BE(4) // at least 28
  header.version = data.readUInt16BE(6)
  header.tocLengthCompressed = data.readUInt32BE(8 + 4) // actually int64!
  header.tocLengthUncompressed = data.readUInt32BE(16 + 4) // actually int64!
  header.cksumAlg = data.readUInt32BE(24) //  cksum_alg 0 is none, 1 is sha1, 2 is md5

  if (header.cksumAlg === 3) {
    throw new Error('not supported')
  }

  var tocData = data.slice(28, 28 + header.tocLengthCompressed)

  zlib.unzip(tocData, function (err, xmlBuffer) {
    if (err) return cb(err)
    xml.parseString(xmlBuffer.toString(), function (err, json) {
      if (!err) {
        var offset = Number(json.xar.toc[0].checksum[0].offset[0])
        var algorithm = json.xar.toc[0].checksum[0]['$'].style
        var size = Number(json.xar.toc[0].checksum[0].size[0])
        var start = 28 + header.tocLengthCompressed + offset
        var cksum = data.slice(start, start + size)
        var hash = crypto.createHash(algorithm)
        hash.update(tocData)
        if (cksum.toString('hex') !== hash.digest('hex')) {
          return console.error('TOC checksum does not match.')
        }
        cb(null, xmlBuffer, json, header)
      }
    })
  })
}
