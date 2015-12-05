var getToc = require('./gettoc')

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
        readFiles(file.file, header, parent + '/' + file.name[0])
        return
      }
      var offset = Number(file.data[0].offset[0])
      var length = Number(file.data[0].length[0])
      var start = 28 + header.tocLengthCompressed + offset
      cb(null, file, data.slice(start, start + length).toString())
    })
  }
}
