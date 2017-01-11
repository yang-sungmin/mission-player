#!/usr/bin/node
'use strict';
var fs = require('fs');
var readline = require('readline');

function processLog(filename) {
	var log = [];
	var rd = readline.createInterface({
		input: fs.createReadStream(filename),
		output: process.stdout,
		terminal: false
	});
	filename = filename.split('.')[0];
	rd.on('line', function(line) {
		if (line) log.push(line);
	});
	rd.on('close', function() {
		console.log(filename,'has',log.length,'records');
		log = log.map(function(x) {
			if (!x) return x;
			x = JSON.parse(x);
			x.LoggingTime = x.LoggingTime.$date;
			if (x.text) {
				x.text = (new Buffer(x.text.$binary, 'base64')).toString();
				x.text = x.text.split('\u0000')[0];
			}
			for (var key in x) {
				if (x[key].$numberLong) x[key] = Number(x[key].$numberLong);
			}
		
			return x;
		});
		console.log('Parsed logs');

		var count = 0;

		for (var i = 1 ; i < log.length; i++) {
			if (new Date(log[i].LoggingTime) - new Date(log[i-1].LoggingTime) > 10 * 60 * 1000) { //separate if gap > 10 mins
				console.log('segment',count,'length',i);
				var slice = log.splice(0,i);
				i = 1;
				var newfile = filename + '_' + count + '.json';
				fs.writeFileSync(newfile, JSON.stringify(slice, null, 2));
				count++;
			}
		}
		console.log('segment',count,'length',i);
		var newfile = filename + '_' + count + '.json';
		fs.writeFileSync(newfile, JSON.stringify(log, null, 2));
		console.log('finished');
	});
}


if (process.argv.length >= 3) {
	for (var i = 2; i < process.argv.length; i++) {
		processLog(process.argv[i]);
	}
}