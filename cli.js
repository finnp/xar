#!/usr/bin/env node

var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))
var extract = require('./extract')

var data = fs.readFileSync(argv._[0])

extract(data, function (err, file, data) {
  if (err) return console.error(err)
  console.log(file.path)
})
