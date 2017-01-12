'use strict'

const mavlink = require('../mavlink');
const MAVLink = require('../mav_messages');

/* Simulates flight controller's waypoint protocol behavior */

class WaypointProtocolInterface extends mavlink {
  //reads new outlink: mavlink for sending messages
  constructor (sysid, compid, version, definitions, outlink) {
    super(sysid, compid, version, definitions || MAVLink);
    this.mission = [];
    this.currentWaypoint = -1;
    this.locked = false;
    this.outlink = outlink;
    this.prevMissionIndex = -1;
    this.receivedMessages = [];
    this.sentMessages = [];

    this.interval = 250;
    this.timerFunc = {};
    this.on('ready', this.registerEvents.bind(this));
  }

  registerEvents () {
    this.on('message', (message) => {
      let msg = this.decodeMessage(message);
      //console.log(this.getMessageName(message.id), msg);
      this.receivedMessages.push(msg);
    });
    this.on('MISSION_REQUEST_LIST', (message, fields) => {
      if (this.locked) {
        this.createMessage('MISSION_ACK', {
          target_system: this.sysid, target_component: this.compid,
          type: this.enumsByName.MAV_MISSION_RESULT.MAV_MISSION_ERROR.value
        }, this.sendMessageOutlink.bind(this));
      } else {
        this.locked = true;
        this.prevMissionIndex = -1;
        this.createMessage('MISSION_COUNT', {
          target_system: this.sysid, target_component: this.compid,
          count: this.mission.length
        }, this.sendMessageOutlink.bind(this));
      }
    });
    this.on('MISSION_REQUEST', (message, fields) => {
      if (this.locked && this.mission[fields.seq] && this.prevMissionIndex + 1 === fields.seq) {
        this.prevMissionIndex++;
        this.createMessage('MISSION_ITEM', this.mission[fields.seq],
                            this.sendMessageOutlink.bind(this));
      } else {
        this.createMessage('MISSION_ACK', {
          target_system: this.sysid, target_component: this.compid,
          type: this.enumsByName.MAV_MISSION_RESULT.MAV_MISSION_INVALID_SEQUENCE.value
        }, this.sendMessageOutlink.bind(this));
      }
    });
    this.on('MISSION_ACK', (message, fields) => {
      if (this.locked && fields.type === this.enumsByName.MAV_MISSION_RESULT.MAV_MISSION_ACCEPTED.value) {
        this.locked = false;
      } else {
        console.log('Nonsense MISSION_ACK message received');
      }
    });

    this.on('MISSION_COUNT', (message, fields) => {
      if (this.locked) {
        this.createMessage('MISSION_ACK', {
          target_system: this.sysid, target_component: this.compid,
          type: this.enumsByName.MAV_MISSION_RESULT.MAV_MISSION_ERROR.value
        }, this.sendMessageOutlink.bind(this));
      } else {
        this.locked = true;
        if (fields.count !== 0) {
          this.mission = [];
          for (let i = 0; i < fields.count; i++) this.mission.push({});
          this.prevMissionIndex = -1;
          this.createMessage('MISSION_REQUEST', {
            target_system: this.sysid, target_component: this.compid,
            seq: 0
          }, this.sendMessageOutlink.bind(this));
        } else {
          this.sendMissionACK();
        }
      }
    });
    this.on('MISSION_ITEM', (message, fields) => {
      if (this.locked && this.mission[fields.seq] && this.prevMissionIndex + 1 === fields.seq) {
        this.prevMissionIndex++;
        this.mission[fields.seq] = fields;
        if (this.mission.length - 1 === fields.seq) {
          this.sendMissionACK();
          return;
        }
        this.createMessage('MISSION_REQUEST', {
          target_system: this.sysid, target_component: this.compid,
          seq: fields.seq + 1
        }, this.sendMessageOutlink.bind(this));
      } else {
        this.createMessage('MISSION_ACK', {
          target_system: this.sysid, target_component: this.compid,
          type: this.enumsByName.MAV_MISSION_RESULT.MAV_MISSION_INVALID_SEQUENCE.value
        }, this.sendMessageOutlink.bind(this));
      }
    });
  }

  sendMessageOutlink (message) {
    let msg = this.decodeMessage(message);
    this.sentMessages.push(msg);
    this.outlink.emit('mavlink', {buffer: message.buffer});
  }

  sendMissionACK () {
    if (this.locked) {
      this.locked = false;
      this.createMessage('MISSION_ACK', {
        target_system: this.sysid, target_component: this.compid,
        type: this.enumsByName.MAV_MISSION_RESULT.MAV_MISSION_ACCEPTED.value
      }, this.sendMessageOutlink.bind(this));
    } else {
      console.log('Tried to send nonsense MISSION_ACK message');
    }
  }
}

module.exports = WaypointProtocolInterface;
