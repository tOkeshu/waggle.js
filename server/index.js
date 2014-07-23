var inherits = require("util").inherits;
var SmokeServer = require("smoke-signals").SmokeServer;
var express = require("express");

var Hive = require("./hive");

function BrocastServer(config) {
  SmokeServer.call(this, config);
  this.hive = new Hive();

  var prefix = this.config.root + "/rooms/:room";
  this.app.post(prefix + "/files/:file/register", this.register.bind(this));
}

inherits(BrocastServer, SmokeServer);

BrocastServer.prototype.register = function(req, res) {
  var roomId = req.param('room');
  var fileId = req.param('file');
  var room   = this.rooms.get(roomId);
  var swarm  = this.hive.get(fileId);
  var user   = room.users.getByToken(req.body.token);

  swarm.users.add(user);
  user.connection.sse("indexupdate", {index: swarm});

  res.json(200, "");
};

module.exports = BrocastServer;

