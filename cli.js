#!/usr/bin/env node

var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))
var extract = require('./lib/extract')
var getToc = require('./lib/gettoc')
var create = require('./lib/create')

var data

if (argv._[0] === 'extract') {
  data = fs.readFileSync(argv._[1])

  extract(data, function (err, file, data) {
    if (err) return console.error(err)
    console.log(file.path)
  })
} else if (argv._[0] === 'toc') {
  data = fs.readFileSync(argv._[1])

  getToc(data, function (err, toc) {
    if (err) return console.error(err)
    console.log(toc.toString())
  })
} else if (argv._[0] === 'create') {
  var dir = argv._[1]
  create(dir).pipe(process.stdout)
}
