var moment = require('moment');
var fs = require('fs');

/** Extend Number object with method to convert numeric degrees to radians */
if (Number.prototype.toRadians === undefined) {
    Number.prototype.toRadians = function() { return this * Math.PI / 180; };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (Number.prototype.toDegrees === undefined) {
    Number.prototype.toDegrees = function() { return this * 180 / Math.PI; };
}

function distance (from, to) {
  var lon1 = from.y;
  var lat1 = from.x;
  var lon2 = to.y;
  var lat2 = to.x;

  var R = 6371e3; // metres
  var φ1 = lat1.toRadians();
  var φ2 = lat2.toRadians();
  var λ1 = lon1.toRadians();
  var λ2 = lon2.toRadians();
  var Δφ = (lat2-lat1).toRadians();
  var Δλ = (lon2-lon1).toRadians();

  var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  var d = R * c;
  return d;
}

function bearing(from, to) {
  var lon1 = from.y;
  var lat1 = from.x;
  var lon2 = to.y;
  var lat2 = to.x;

  var φ1 = lat1.toRadians();
  var φ2 = lat2.toRadians();
  var λ1 = lon1.toRadians();
  var λ2 = lon2.toRadians();
  var Δφ = (lat2-lat1).toRadians();
  var Δλ = (lon2-lon1).toRadians();

  var y = Math.sin(λ2-λ1) * Math.cos(φ2);
  var x = Math.cos(φ1)*Math.sin(φ2) -
          Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
  var brng = Math.atan2(y, x).toDegrees();

  return brng;
}

function destination (from, d, brng) { 
  var lon1 = from.y;
  var lat1 = from.x;

  var R = 6371e3; // metres
  var φ1 = lat1.toRadians();
  var λ1 = lon1.toRadians();

  var δ = d / R; // angular distance in radians
  var θ = brng.toRadians();

  var sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1);
  var sinδ = Math.sin(δ), cosδ = Math.cos(δ);
  var sinθ = Math.sin(θ), cosθ = Math.cos(θ);

  var sinφ2 = sinφ1*cosδ + cosφ1*sinδ*cosθ;
  var φ2 = Math.asin(sinφ2);
  var y = sinθ * sinδ * cosφ1;
  var x = cosδ - sinφ1 * sinφ2;
  var λ2 = λ1 + Math.atan2(y, x);
  return new Point(φ2.toDegrees(), (λ2.toDegrees()+540)%360-180, from.z, brng);
}

var Point = function (x, y, z, heading, velocity) {
  this.x = x || 0;
  this.y = y || 0;
  this.z = z || 0;
  this.heading = heading || 0;
  this.velocity = velocity || 0;
};

var PositionLog = function (point, offset) {
  this.type = 'Position';
  for (var k in point) this[k] = point[k];
  this.offset = offset;
};

PositionLog.prototype.toMavMessages = function(start) {
  try {
    new Date(start).toISOString();
    new Date(Number(new Date(start)) + this.offset).toISOString();
  } catch (err) {
    throw err;
  }
  var logs = [];
  logs.push({
    _t: 'Msg_attitude',
    time_boot_ms: this.offset,
    roll: 0,
    pitch: 0,
    yaw: (this.heading+180).toRadians(),
    rollspeed: 0,
    pitchspeed: 0,
    yawspeed: 0,
    LoggingTime: new Date(Number(new Date(start)) + this.offset).toISOString()
  });
  logs.push({
    _t: 'Msg_global_position_int',
    time_boot_ms: this.offset,
    lat: Math.floor(this.x*1e7),
    lon: Math.floor(this.y*1e7),
    alt: Math.floor(this.z*1e3),
    relative_alt: Math.floor(this.z*1e3),
    vx: Math.floor(this.velocity * 100),
    vy: 0,
    vz: 0,
    hdg: Math.floor((this.heading%360 + 540) % 360 * 100),
    LoggingTime: new Date(Number(new Date(start)) + this.offset).toISOString()
  });
  logs.push({
    _t: "Msg_mount_status",
    target_system: 0,
    target_component: 0,
    pointing_a: 0,
    pointing_b: 0,
    pointing_c: Math.floor((this.heading+180)*100),
    LoggingTime: new Date(Number(new Date(start)) + this.offset).toISOString()
  });
  logs.push({
    _t: "Msg_gps_raw_int",
    time_usec: Number(new Date(start)) + this.offset,
    fix_type: 5,
    lat: Math.floor(this.x*1e7),
    lon: Math.floor(this.y*1e7),
    alt: Math.floor(this.z*1e3),
    eph: 9999,
    epv: 65535,
    vel: Math.floor(this.velocity * 100),
    cog: Math.floor((this.heading%360 + 540) % 360 * 100),
    satellites_visible: 12,
    LoggingTime: new Date(Number(new Date(start)) + this.offset).toISOString()
  });
  logs.push({
    _t: "Msg_gps2_raw",
    time_usec: Number(new Date(start)) + this.offset,
    fix_type: 5,
    lat: Math.floor(this.x*1e7),
    lon: Math.floor(this.y*1e7),
    alt: Math.floor(this.z*1e3),
    eph: 9999,
    epv: 65535,
    vel: Math.floor(this.velocity * 100),
    cog: Math.floor((this.heading%360 + 540) % 360 * 100),
    satellites_visible: 12,
    dgps_numch: 8,
    dgps_age: 0,
    LoggingTime: new Date(Number(new Date(start)) + this.offset).toISOString()
  });
  return logs;
};

var ItemReachedLog = function (count, offset) {
  this.type = 'ItemReached';
  this.count = count;
  this.offset = offset;
};

ItemReachedLog.prototype.toMavMessages = function(start, offset) {
  return [{
    _t: 'Msg_mission_item_reached',
    seq: this.count,
    LoggingTime: new Date(Number(new Date(start)) + this.offset).toISOString()
  }];
}

function updatePosition (from, to, velocity, interval) {
  var position = destination(from, velocity * interval, bearing(from, to));
  if (distance(from, to) > velocity * interval) {
    position.velocity = velocity;  
  } else {
    position.x = to.x;
    position.y = to.y;
    to.velocity = distance(from, to) / interval;
  }

  // limit vertical velocity to 1m/s
  if (Math.abs(from.z - to.z) > interval*velocity) {
    if (from.z < to.z) position.z += interval*velocity;
    else position.z -= interval * velocity;
    position.velocity = Math.sqrt(Math.pow(position.velocity,2) + interval * interval * velocity * velocity);
  } else {
    position.z = to.z;
    position.velocity = Math.sqrt(Math.pow(position.velocity,2) + Math.pow(from.z-to.z,2));
  }

  //limit angular velocity to 90 deg/s
  if (Math.abs(from.heading - position.heading) > 90 * interval) {
    var diff = (((position.heading - from.heading) % 360) + 360) % 360;
    if (diff < 180) position.heading = from.heading - 90 * interval;
    else position.heading = from.heading + 90 * interval;
  } else {
    position.heading = bearing(from, to);
  }
  position.heading %= 360;
  if (position.heading > 180) position.heading -= 360;

  return position;
}


function toMavlink(log, start, missionInfo) {
  var exportLog = [];
  for (var i = 0; i < log.length; i++) {
    var newLog = log[i].toMavMessages(start);
    for (var j in newLog) exportLog.push(newLog[j]);
  }
  start = Number(new Date(start));
  var end = start + log[log.length-1].offset;
  exportLog.push(missionInfo);
  exportLog.push({
    _t: 'Msg_sys_status',
    onboard_control_sensors_present: 0,
    onboard_control_sensors_enabled: 0,
    onboard_control_sensors_health: 0,
    load: 800,
    voltage_battery: 24700,
    current_battery: 0,
    battery_remaining: 78,
    drop_rate_comm: 0,
    errors_comm: 0,
    errors_count1: 0,
    errors_count2: 0,
    errors_count3: 0,
    errors_count4: 0,
    LoggingTime: new Date(start).toISOString()
  });
  for (i = start; i < end + 1000; i+= 1000) {
    exportLog.push({
      _t: "Msg_heartbeat",
      type: 14,
      autopilot: 3,
      base_mode: 209,
      custom_mode: 0,
      system_status: 3,
      mavlink_version: 3,
      LoggingTime: new Date(i).toISOString()
    });
    exportLog.push({
      _t: 'Msg_sys_status',
      onboard_control_sensors_present: 0,
      onboard_control_sensors_enabled: 0,
      onboard_control_sensors_health: 0,
      load: 800,
      voltage_battery: 24700,
      current_battery: 0,
      battery_remaining: 78,
      drop_rate_comm: 0,
      errors_comm: 0,
      errors_count1: 0,
      errors_count2: 0,
      errors_count3: 0,
      errors_count4: 0,
      LoggingTime: new Date(i).toISOString()
    });
  }
  return exportLog.sort(function comp(a,b) {
    return (new Date(a.LoggingTime)) - (new Date(b.LoggingTime));
  });
}

//interval in ms
function logFromMission (mission, missionInfo, home, startTime, interval, initVelocity) {
  var position = home;
  var timeStep = 0;
  var logs = [];
  logs.push(new PositionLog(position, 0));
  for (var i = 0 ; i < mission.length; i++) {
    if (mission[i].command !== 16) {
      logs.push(new ItemReachedLog(i, timeStep * interval));
      continue;
    }
    if (Math.abs(mission[i].x) < 0.00001 && Math.abs(mission[i].y) < 0.00001 && Math.abs(mission[i].z) < 0.00001) {
      logs.push(new ItemReachedLog(i, timeStep * interval));
      continue;
    }
    var dest = new Point(mission[i].x, mission[i].y, mission[i].z, 0);
    while (distance(position, dest) > 0.1 || Math.abs(position.z - dest.z) > 0.1) {
      //if (timeStep > i * 10) break;
      timeStep++;
      position = updatePosition(position, dest, initVelocity, interval / 1000);
      logs.push(new PositionLog(position, timeStep * interval));
    }
    logs.push(new ItemReachedLog(i, timeStep * interval));
  }
  return toMavlink(logs, startTime, missionInfo);
}

if (require.main === module) {
  if (process.argv.length >= 7) {
    var argv = process.argv;
    var mission = JSON.parse(fs.readFileSync(argv[2]).toString());

    var home = new Point(Number(argv[4]), Number(argv[5]), Number(argv[6]));
    var log = logFromMission (mission.missions[argv[3]], mission.info[argv[3]], home,
      mission.missions[argv[3]][0].LoggingTime, 50, 3);
    console.log(JSON.stringify(log, null, 2));
  } else {
    console.log('Usage: node mission_simulator.js [filename] [index] [lat] [lon] [alt]');
  }
}


module.exports = {
  logFromMission: logFromMission
}