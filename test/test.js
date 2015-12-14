var xar = require('../')
var concat = require('concat-stream')
var path = require('path')
var test = require('tape')

test('pack und unpack', function (t) {
  var nFiles = 6
  var files = {}
  xar.pack(path.join(__dirname, 'dir'))
    .pipe(concat(function (buffer) {
      xar.unpack(buffer, function (err, file, content) {
        if (err) return t.fail(err)
        files[file.path] = content
        nFiles--
        if (nFiles === 0) end()
      })
    }))
  function end () {
    t.equal(files['dir/subdir/test.txt'], '---\n')
    t.equal(files['dir/subdir2/test2.txt'], 'moin moin\n')
    t.equal(files['dir/hi.txt'], 'what what what?\n')
    t.end()
  }
})

test('pack und unpack with gzip', function (t) {
  var nFiles = 6
  var files = {}
  xar.pack(path.join(__dirname, 'dir'), {compression: 'gzip'})
    .pipe(concat(function (buffer) {
      xar.unpack(buffer, function (err, file, content) {
        if (err) return t.fail(err)
        files[file.path] = content
        nFiles--
        if (nFiles === 0) end()
      })
    }))
  function end () {
    t.equal(files['dir/subdir/test.txt'], '---\n')
    t.equal(files['dir/subdir2/test2.txt'], 'moin moin\n')
    t.equal(files['dir/hi.txt'], 'what what what?\n')
    t.end()
  }
})

test('throw error if compression is not supported', function (t) {
  t.plan(1)
  xar.pack(path.join(__dirname, 'dir'), {compression: 'whatzip'})
    .on('error', function (err) {
      t.ok(err, 'unsupported')
    })
})
