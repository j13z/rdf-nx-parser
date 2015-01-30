#!/usr/bin/env node
'use strict';

/**
 * Minimal example that demonstrates line-based reading of an N-Quads file.
 *
 * Outputs predicate IRIs. Accepts input from `stdin` or reads it from a
 * (gzipped) file, if an argument is passed.
 */


var parser   = require('../');
var fs       = require('fs');
var Stream   = require('stream');
var Readline = require('readline');
var zlib     = require('zlib');


var filename = process.argv[2];

// Use `readline` for line based reading:

var readline = Readline.createInterface({
	input:  getInputStream(filename),
	output: new Stream()
});


readline.on('line', function (line) {

	var quad = parser.parseQuad(line);

	if (!quad) {
		return;
	}

	process.stdout.write(quad.predicate.value + '\n');
})
.on('close', function () {
	process.exit(0);
});



/**
 * Retuns an input stream, either `stdin` or a stream to a file argument
 * (gzip supported).
 *
 * @return {Stream}
 */
function getInputStream(filename) {

	if (filename) {
		// File stream -- uncompressed or gzip

		var fileStream = fs.createReadStream(filename);
		var extension = filename.slice(filename.lastIndexOf('.') + 1);

		if (extension === 'gz') {
			return fileStream.pipe(zlib.createGunzip());
		} else {
			return fileStream;
		}
	}
	else {
		// stdin
		process.stdin.setEncoding('utf8');
		return process.stdin;
	}
}
