var xml = require('xml')
var zlib = require('zlib')
var crypto = require('crypto')
var os = require('os')
var path = require('path')
var fs = require('fs')
var through = require('through2')

var cksumSize = 20

var tocNode = [
  {'creation-time': (new Date()).toISOString()}, // '2015-12-02T12:21:56'
  { 'checksum': [
    {'_attr': {'style': 'sha1'}},
    {'offset': 0},
    {'size': cksumSize}
  ]}
]
var rootNode = {
  xar: [ { toc: tocNode } ]
}

var cwd = './test'
var tmpFile = path.resolve(path.join(os.tmpDir(), 'heap.tmp'))
var start = 0

function statAll (file, parent, cb) {
  fs.lstat(file, function (err, stat) {
    if (err) return cb(err)
    if (stat.isDirectory()) {
      var node = createFileNode(file, stat, parent)
      fs.readdir(file, function (err, files) {
        if (err) return cb(err)
        var todo = files.length
        files
          .map(function (sub) {
            return path.join(file, sub)
          })
          .forEach(function (file) {
            statAll(file, node, function (err) {
              if (err) return cb(err)
              todo--
              if (todo === 0) cb()
            })
          })
      })
    } else {
      var hash = crypto.createHash('sha1')
      stat.offset = cksumSize + start
      fs.createReadStream(file)
        .pipe(through(function (chunk, enc, cb) {
          hash.update(chunk)
          this.push(chunk)
          cb()
        }))
        .pipe(fs.createWriteStream(tmpFile, {flags: 'r+', start: start}))
        .on('finish', function () {
          stat.hash = hash.digest('hex')
          createFileNode(file, stat, parent)
          cb()
        })
      start += stat.size
    }
  })
}
statAll(cwd, tocNode, heapFinished)

function heapFinished () {
  var xmlToc = xml(rootNode, {indent: '  ', declaration: true})
  var uncompressedToc = new Buffer(xmlToc, 'utf8')
  zlib.deflate(uncompressedToc, function (err, compressedToc) {
    if (err) return console.error(err)
    var hash = crypto.createHash('sha1')
    hash.update(compressedToc)

    var header = (new Buffer(28)).fill(0)
    header.write('xar!')
    header.writeUInt16BE(28, 4) // header size
    header.writeUInt16BE(1, 6) // version
    header.writeUInt32BE(compressedToc.length, 8 + 4) // tocLengthCompressed
    header.writeUInt32BE(uncompressedToc.length, 16 + 4) // tocLengthUncompressed
    header.writeUInt32BE(1, 24) //  cksum_alg 0 is none, 1 is sha1, 2 is md5
    process.stdout.write(header)
    process.stdout.write(compressedToc)
    // complete heap
    process.stdout.write(hash.digest())
    fs.createReadStream(tmpFile).pipe(process.stdout)
  })
}

var id = 1
function createFileNode (name, stats, parent) {
  var content = [{'_attr': {id: id++}}]
  if (!stats.isDirectory()) {
    content.push({
      'data': [
        {length: stats.size},
        {size: stats.size},
        {encoding: {_attr: {style: 'application/octet-stream'}}},
        {offset: stats.offset},
        {'extracted-checksum': [{_attr: {style: 'sha1'}}, stats.hash]},
        {'archived-checksum': [{_attr: {style: 'sha1'}}, stats.hash]}
      ]
    })
  }
  content.push({'ctime': stats.ctime.toISOString()}) // TODO: Correct time format?
  content.push({'mtime': stats.mtime.toISOString()})
  content.push({'atime': stats.atime.toISOString()})
  content.push({'gid': stats.gid})
  content.push({'uid': stats.uid})
  // content.push({'group': }) // TODO: could be obtained with module 'userid'
  // content.push({'user': })
  content.push({'mode': stats.mode.toString(8)})
  content.push({'deviceno': stats.dev})
  content.push({'inode': stats.ino})
  content.push({'type': stats.isDirectory() ? 'directory' : 'file'})
  content.push({'name': path.basename(name)})
  var node = {file: content}
  parent.push(node)
  return content
}
