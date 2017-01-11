#!/usr/bin/node
var io = require('socket.io-client');
var fs = require('fs');
var mavlink = require('./mavlink');

var socket = io('http://aws.nearthlab.com:5050');

function logFeed(logList) {
  var mav = new mavlink(1,1);

  mav.on('ready', function() {
    var armed = false;
    function playNext(resolve, reject, log, index) {
      var msgName = log[index]._t.toUpperCase().replace('MSG_','');
      
      if (msgName === 'HEARTBEAT' && !armed) {
        console.log(log[index].base_mode);
        if (log[index].base_mode & 128) {
          console.log('Armed on log index', index);
          armed = true;
        }
      }
      
      if (msgName !== 'ANALYSISMODEL') {
        mav.createMessage(msgName, log[index], function(msg) {
          socket.emit('mavlink', {buffer: msg.buffer});
        });
      }
      
      if (!armed) {
        playNext(resolve, reject, log, index + 1);
        if (index < log.length - 1) return;
      }
      

      if (index >= log.length - 1) {
        resolve();
      } else {
        var interval = new Date(log[index+1].LoggingTime) - new Date(log[index].LoggingTime);
        setTimeout(function() { playNext(resolve, reject, log, index + 1); }, interval);
      }
    }


    function playLog(logfile, offset) {
      offset = offset || 0;
      var log = JSON.parse(fs.readFileSync(logfile).toString());
      return new Promise(
        function(resolve, reject) {
          playNext(resolve, reject, log, offset);
        }
      ).then(function() {
        console.log('Log file play finished');
      });
    }

    playLog(logList[0]);
  });
}

if (process.argv.length >= 3) {
  var logList = process.argv.slice(2);
  console.log(logList);
  logFeed(logList);
} else {
  console.log('Usage: ./log_feed.js [file1] [file2]')
}