var zlib = require('zlib')
var xml = require('xml2js')

module.exports = extract

function extract (data, cb) {
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

  zlib.unzip(tocData, function (err, buffer) {
    if (!err) {
      xml.parseString(buffer.toString(), function (err, result) {
        if (!err) {
          readFiles(result.xar.toc[0].file)
        }
      })
    }
  })

  function readFiles (fileList, parent) {
    parent = parent || ''
    fileList.forEach(function (file) {
      if (file.type[0] === 'directory') {
        // recurse down directories
        readFiles(file.file, parent + '/' + file.name[0])
        return
      }
      var offset = Number(file.data[0].offset[0])
      var length = Number(file.data[0].length[0])
      var start = 28 + header.tocLengthCompressed + offset
      file.path = parent + '/' + file.name[0]
      cb(null, file, data.slice(start, start + length).toString())
    })
  }
}
