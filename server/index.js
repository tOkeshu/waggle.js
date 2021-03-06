var inherits = require("util").inherits;
var SmokeServer = require("smoke-signals").SmokeServer;
var express = require("express");

var Hive = require("./hive");

function WaggleServer(config) {
  SmokeServer.call(this, config);
  this.hive = new Hive();

  var prefix = this.config.root + "/rooms/:room";
  this.app.post(prefix + "/files/:file/register", this.register.bind(this));
  this.app.post(prefix + "/files/:file/index", this.updateIndex.bind(this));

  var OPTIONS = {root: __dirname + "/../"};
  this.app.use('/static', express.static(__dirname + '/../client'));
  this.app.get("/", function(req, res) {
    res.sendfile('/client/index.html', OPTIONS);
  });

  this.hive.on("add", this._setupSwarm.bind(this));
}

inherits(WaggleServer, SmokeServer);

WaggleServer.prototype._setupSwarm = function(swarm) {
  swarm.on("chunk:peers:add", function(chunkId, user) {
    swarm.users.forEach(function(peer) {
      if (peer === user)
        return;

      peer.connection.sse("indexupdate", {
        swarm: swarm.id,
        chunk: chunkId,
        peersToAdd: [user.uid],
        peersToRemove: []
      });
    });
  });

  swarm.on("chunk:peers:remove", function(chunkId, user) {
    swarm.users.forEach(function(peer) {
      if (peer === user)
        return;

      peer.connection.sse("indexupdate", {
        swarm: swarm.id,
        chunk: chunkId,
        peersToAdd: [],
        peersToRemove: [user.uid]
      });
    });
  });
};

WaggleServer.prototype.register = function(req, res) {
  var roomId = req.param('room');
  var fileId = req.param('file');
  var room   = this.rooms.get(roomId);
  var swarm  = this.hive.get(fileId);
  var user   = room.users.getByToken(req.body.token);

  swarm.users.add(user);
  user.connection.sse("indexstate", {index: swarm, swarm: fileId});

  res.json(200, "");
};

WaggleServer.prototype.updateIndex = function(req, res) {
  var roomId = req.param('room');
  var fileId = req.param('file');
  var room   = this.rooms.get(roomId);
  var swarm  = this.hive.get(fileId);
  var user   = room.users.getByToken(req.body.token);

  swarm.chunk(req.body.chunk).availableFrom(user);
  res.json(200, "");
};

module.exports = WaggleServer;

