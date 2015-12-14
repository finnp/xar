# xar
[![NPM](https://nodei.co/npm/xar.png)](https://nodei.co/npm/xar/)

This is a very basic/alpha version of a JS [Mac OSX xar](https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/xar.1.html) implementation.

It currently does not support actual compression and should be used with caution.

Pack a directory like:
```js
var xar = require('xar')
xar.pack(dir, {compresssion: 'gzip'}).pipe(process.stdout)
```
Compression formats supported: `none`, `gzip`
Default is `gzip`

Unpack a directory like:
```js
var fs =require('fs')

xar.unpack(data, function (err, file, content) {
  if (err) return console.error(err)
  if (file.type[0] === 'directory') {
    fs.mkdirSync(file.path)
  } else {
    fs.writeFileSync(file.path, content)
  }
})
```

## xar.pack(dir)

returns a readable stream

It is not possible to create the archive in a streaming fashion though, since
it has a TOC in the beginning. The file is constructed in a tmp file, which is then
streamed to you.

## xar.unpack(file, cb)

callback called for each file with `(err, file, content)`

file is the parsed header from the TOC
