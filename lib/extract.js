var getToc = require('./gettoc')
var zlib = require('zlib')

module.exports = extract

function extract (data, cb) {
  getToc(data, function (err, buffer, json, header) {
    if (err) return cb(err)
    readFiles(json.xar.toc[0].file, header)
  })

  function readFiles (fileList, header, parent) {
    parent = parent || ''
    fileList.forEach(function (file) {
      file.path = (parent + '/' + file.name[0]).slice(1)
      if (file.type[0] === 'directory') {
        // recurse down directories
        cb(null, file)
        if (file.file) readFiles(file.file, header, parent + '/' + file.name[0])
        return
      }
      var encoding = file.data[0].encoding[0].$.style
      var offset = Number(file.data[0].offset[0])
      var length = Number(file.data[0].length[0])
      var start = 28 + header.tocLengthCompressed + offset
      var compressedContent = data.slice(start, start + length)
      if (encoding === 'application/x-gzip') {
        zlib.unzip(compressedContent, function (err, result) {
          if (err) return cb(err)
          cb(null, file, result.toString())
        })
      } else if (encoding === 'application/octet-stream') {
        cb(null, file, compressedContent.toString())
      } else {
        cb(new Error('Unsupported encoding ' + encoding))
      }
    })
  }
}
