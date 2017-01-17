var moment = require('moment');

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
  this.x = x;
  this.y = y;
  this.z = z;
  this.heading = heading;
  this.velocity = velocity;
};

var PositionLog = function (point, offset) {
  this.type = 'Position';
  for (var k in point) this[k] = point[k];
  this.offset = offset;
};

var ItemReachedLog = function (count, offset) {
  this.type = 'ItemReached';
  this.count = count;
  this.offset = offset;
};


function updatePosition (from, to, velocity, interval) {
  var position;
  if (distance(from, to) > velocity * interval) {
    position = destination(from, velocity * interval, bearing(from, to));
    position.velocity = velocity;  
  } else {
    position = to;
    to.velocity = distance(from, to) / interval;
  }

  // limit vertical velocity to 1m/s
  if (Math.abs(from.z - to.z) > interval) {
    if (from.z < to.z) position.z += interval;
    else position.z -= interval;
    position.velocity = Math.sqrt(Math.pow(position.velocity,2) + interval * interval);
  } else {
    position.z = to.z;
    position.velocity = Math.sqrt(Math.pow(position.velocity,2) + Math.pow(from.z-to.z,2));
  }

  //limit angular velocity to 180 deg/s
  if (Math.abs(from.heading - position.heading) > 180 * interval) {
    var diff = (position.heading - from.heading) % 360;
    if (diff > 180) position.heading = from.heading - 180 * interval;
    else position.heading = from.heading + 180 * interval;
  }
  position.heading %= 360;
  if (position.heading > 180) position.heading -= 360;

  return position;
}

function toMavlink(log) {

}

//interval in ms
function logFromMission (mission, home, startTime, interval, initVelocity) {
  var position = home;
  var timeStep = 0;
  var logs = [];
  logs.push(new PositionLog(position, 0));
  for (var i = 0 ; i < mission.length; i++) {
    console.log(mission[i].command);
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
  return logs;
}

module.exports = {
  logFromMission: logFromMission
}