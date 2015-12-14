#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var argv = require('minimist')(process.argv.slice(2))
var extract = require('./lib/extract')
var getToc = require('./lib/gettoc')
var pack = require('./lib/create')

var data

if (argv._[0] === 'extract') {
  data = fs.readFileSync(argv._[1])
  var outDir = argv._[2] || '.'

  extract(data, function (err, file, data) {
    if (err) return console.error(err)
    var p = path.join(outDir, file.path)
    if (file.type[0] === 'directory') {
      console.log('mkdir', file.path)
      fs.mkdirSync(p)
    } else {
      console.log('extract', file.path)
      fs.writeFileSync(p, data)
    }
  })
} else if (argv._[0] === 'toc') {
  data = fs.readFileSync(argv._[1])

  getToc(data, function (err, toc) {
    if (err) return console.error(err)
    console.log(toc.toString())
  })
} else if (argv._[0] === 'create') {
  var dir = argv._[1]
  pack(dir, argv).pipe(process.stdout)
}
