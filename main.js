#!/usr/bin/node
var io = require('socket.io-client');
var fs = require('fs');
var mavlink = require('./mavlink');
var WaypointProtocolInterface = require('./test/WaypointProtocolInterface');

var socket = io('http://aws.nearthlab.com:5050');

function logFeed(logList) {
  var mav = new mavlink(1,1);

  mav.on('ready', function() {

    var fc = new WaypointProtocolInterface(mav.sysid, mav.compid, undefined, undefined, socket);
    fc.on('ready', function () {
      socket.on('mavlink', function(data) {
        fc.parse(data.buffer);
      });
    });


    var armed = false;
    function playNext(resolve, reject, log, mission, index, timediff) {
      if (index >= log.length) {
        resolve();
        return;
      }
      if (!armed) {
        for (; index < log.length; index++) {
          var msgName = log[index]._t.toUpperCase().replace('MSG_','');
          if (msgName === 'HEARTBEAT' && !armed) {
            if (log[index].base_mode & 128) {
              console.log('*********Armed on log index', index);
              armed = true;
              timediff = new Date() - new Date(log[index].LoggingTime);
              break;
            }
          }
          if (msgName === 'MISSION_COUNT') {
            for (var i = 0; i < mission.info.length; i++) {
              if (log[index].LoggingTime === mission.info[i].LoggingTime) {
                fc.mission = mission.missions[i];
                console.log('Mission set to mission #' + i);
                break;
              }
            }
          }
        }
      }

      while (index < log.length && (Number(new Date(log[index].LoggingTime)) + timediff < Number(new Date()) ) ) {
        var msgName = log[index]._t.toUpperCase().replace('MSG_','');

        if (msgName === 'MISSION_COUNT') {
          for (var i = 0; i < mission.info.length; i++) {
            if (log[index].LoggingTime === mission.info[i].LoggingTime) {
              fc.mission = mission.missions[i];
              console.log('Mission set to mission #' + i);
              break;
            }
          }
        }

        if (msgName !== 'ANALYSISMODEL') {
          mav.createMessage(msgName, log[index], function(msg) {
            socket.emit('mavlink', {buffer: msg.buffer});
          });
          //console.log('[' + (new Date(log[index].LoggingTime) - new Date(log[0].LoggingTime))/1000 + ']', msgName);
        }

        index++;
      }
      setTimeout(function() { playNext(resolve, reject, log, mission, index, timediff); }, 100);
    }

    function playLog(logfile, offset) {
      offset = offset || 0;
      var log = JSON.parse(fs.readFileSync(logfile).toString());
      var mission = JSON.parse(fs.readFileSync(logfile.replace('.json','_mission.json')).toString());
      console.log('Log file has ' + (new Date(log[log.length-1].LoggingTime) - new Date(log[0].LoggingTime))/1000 + ' seconds of log');
      return new Promise(
        function(resolve, reject) {
          var timediff = new Date() - new Date(log[0].LoggingTime);
          playNext(resolve, reject, log, mission, offset, timediff);
        }
      );
    }

    
    function play (i, repeat) {
      if (i >= logList.length) {
        console.log('All logs are played.');
        socket.close();
        return;
      }
      playLog(logList[i]).then(function() {
        console.log(logList[i] + ' finished playing.');
        if (repeat) play((i + 1) % logList.length, repeat);
        else if (i < logList.length) play(i+1, repeat);
      });
    }
    play(0, false);
  });
}

if (process.argv.length >= 3) {
  var logList = process.argv.slice(2);
  logFeed(logList);
} else {
  console.log('Usage: ./log_feed.js [file1] [file2]')
}