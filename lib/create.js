var xml = require('xml')
var zlib = require('zlib')
var crypto = require('crypto')
var os = require('os')
var path = require('path')
var fs = require('fs')
var selectRanges = require('ranges-stream')
var through = require('through2')
var readonly = require('read-only-stream')
var PassThrough = require('stream').PassThrough

var cksumSize = 20

module.exports = create

function create (files, opts) {
  var id = 1
  opts = opts || {}
  opts.compression = opts.compression || 'gzip'
  var out = new PassThrough()

  if (opts.compression === 'gzip') {
    var compressionStream = zlib.createGzip
    var encodingStyle = 'application/x-gzip'
  } else if (opts.compression === 'none') {
    compressionStream = function () { return new PassThrough() }
    encodingStyle = 'application/octet-stream'
  } else {
    process.nextTick(function () {
      out.emit('error', new Error('Unsupported compression'))
    })
    return readonly(out)
  }

  var tocNode = [
    {'creation-time': (new Date()).toISOString()},
    { 'checksum': [
      {'_attr': {'style': 'sha1'}},
      {'offset': 0},
      {'size': cksumSize}
    ]}
  ]
  var rootNode = {
    xar: [ { toc: tocNode } ]
  }

  var tmpName = crypto.randomBytes(16).toString('hex') + 'heap.tmp'
  var tmpFile = path.resolve(path.join(os.tmpDir(), tmpName))
  var start = 0

  var filelist = [] // how the files are ordered in the heap

  function collectFiles (files, parent, cb) {
    var todo = files.length
    if (todo === 0) return cb()
    files.forEach(function (file) {
      fs.lstat(file, function (err, stat) {
        if (err) return cb(err)
        if (stat.isDirectory()) {
          var node = createDirNode(file, stat, parent)
          fs.readdir(file, function (err, files) {
            if (err) return cb(err)
            files = files
              .map(function (sub) {
                return path.join(file, sub)
              })
            collectFiles(files, node, function (err) {
              if (err) return cb(err)
              todo--
              if (todo === 0) cb()
            })
          })
        } else {
          var hash = crypto.createHash('sha1')
          var archivedHash = crypto.createHash('sha1')
          var archivedLength = 0
          filelist.push(stat)
          stat.start = start
          fs.createReadStream(file)
            .pipe(through(function (chunk, enc, cb) {
              hash.update(chunk)
              this.push(chunk)
              cb()
            }))
            .pipe(compressionStream())
            .pipe(through(function (chunk, enc, cb) {
              archivedHash.update(chunk)
              archivedLength += chunk.length
              this.push(chunk)
              cb()
            }))
            .pipe(fs.createWriteStream(tmpFile, {flags: 'a+', start: start}))
            .on('finish', function () {
              stat.hash = hash.digest('hex')
              stat.archivedHash = archivedHash.digest('hex')
              stat.archivedLength = archivedLength
              stat.data = createFileNode(file, stat, parent)
              todo--
              if (todo === 0) cb()
            })
          start += stat.size + 20 // assuming compressed file will not be bigger than that
        }
      })
    })
  }
  if (typeof files === 'string') files = [files]
  collectFiles(files, tocNode, heapFinished)

  return readonly(out)

  function heapFinished () {
    // calculate defragmented offsets
    var pos = cksumSize
    filelist.forEach(function (file) {
      file.data.offset = pos // change reference
      pos += file.archivedLength
    })
    var ranges = filelist.map(function (file) {
      return { start: file.start, end: file.start + file.archivedLength }
    })

    // create TOC
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
      out.write(header)
      out.write(compressedToc)
      // complete heap
      out.write(hash.digest())
      fs.createReadStream(tmpFile)
        .pipe(selectRanges(ranges))
        .pipe(out).on('end', function () {
          fs.unlink(tmpFile)
        })
    })
  }

  function createFileNode (name, stats, parent) {
    var content = [{'_attr': {id: id++}}]
    var offsetNode = { offset: stats.offset }
    content.push({
      'data': [
        {length: stats.archivedLength},
        {size: stats.size},
        {encoding: {_attr: {style: encodingStyle}}},
        offsetNode,
        {'extracted-checksum': [{_attr: {style: 'sha1'}}, stats.hash]},
        {'archived-checksum': [{_attr: {style: 'sha1'}}, stats.archivedHash]}
      ]
    })
    content.push({'ctime': stats.ctime.toISOString()})
    content.push({'mtime': stats.mtime.toISOString()})
    content.push({'atime': stats.atime.toISOString()})
    content.push({'gid': stats.gid})
    content.push({'uid': stats.uid})
    // content.push({'group': })
    // content.push({'user': })
    content.push({'mode': stats.mode.toString(8)})
    content.push({'deviceno': stats.dev})
    content.push({'inode': stats.ino})
    content.push({'type': 'file'})
    content.push({'name': path.basename(name)})
    var node = {file: content}
    parent.push(node)
    return offsetNode
  }

  function createDirNode (name, stats, parent) {
    var content = [{'_attr': {id: id++}}]
    content.push({'ctime': stats.ctime.toISOString()})
    content.push({'mtime': stats.mtime.toISOString()})
    content.push({'atime': stats.atime.toISOString()})
    content.push({'gid': stats.gid})
    content.push({'uid': stats.uid})
    // content.push({'group': })
    // content.push({'user': })
    content.push({'mode': stats.mode.toString(8)})
    content.push({'deviceno': stats.dev})
    content.push({'inode': stats.ino})
    content.push({'type': 'directory'})
    content.push({'name': path.basename(name)})
    var node = {file: content}
    parent.push(node)
    return content
  }
}
