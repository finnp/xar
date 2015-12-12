var extract = require('./lib/extract')
var getToc = require('./lib/gettoc')
var pack = require('./lib/create')

exports.extract = extract
exports.unpack = extract

exports.pack = pack
exports.create = pack

exports.getToc = getToc
