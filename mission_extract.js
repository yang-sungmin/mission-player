#!/usr/bin/node
'use strict';
var fs = require('fs');
var readline = require('readline');

function processLog(filename) {
	var prefix = filename.split('.')[0];
	if (filename[0] !== '/') filename = './' + filename;
	var log = require(filename);
	var missions = [];
	var missionInfo = [];

	var missionCount = -1;
	var seq = 0;

	for (var i = 1 ; i < log.length; i++) {
		var msgName = log[i]._t.toUpperCase().replace('MSG_','');
		if (msgName === 'MISSION_COUNT') {
			if (log[i].count === 0) continue;
			missionCount++;
			missions.push([]);
			missionInfo.push(log[i]);
			for (var j = 0; j < log[i].count; j++) missions[missionCount].push(null);
		} else if (msgName === 'MISSION_ITEM') {
			missions[missionCount][log[i].seq] = log[i];
		}
	}
	fs.writeFileSync(prefix+'_mission.json', JSON.stringify({missions:missions, info: missionInfo}, null, 2));
	console.log(missionCount + 1,  'missions were detected and written.');
}


if (process.argv.length >= 3) {
	for (var i = 2; i < process.argv.length; i++) {
		processLog(process.argv[i]);
	}
}