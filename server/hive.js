var inherits     = require("util").inherits;
var extend       = require("util")._extend;
var EventEmitter = require("events").EventEmitter;
var Users        = require("smoke-signals").Users;

function Swarm(id, chunks) {
  this.id = id;
  this.chunks = chunks;

  this.users = new Users();
  this.users.on("add", function(user) {
    user.on("disconnection", function() {
      for (var chunkId in this.chunks)
        this.chunk(chunkId).remove(user);
      this.users.remove(user);
    }.bind(this));
  }.bind(this));

  EventEmitter.call(this);
}

inherits(Swarm, EventEmitter);

Swarm.prototype = extend(Swarm.prototype, {
  chunk: function(chunkId) {
    chunkId = parseInt(chunkId);

    return {
      availableFrom: function(user) {
        var peers = this.chunks[chunkId];
        if (peers && peers.indexOf(user.uid) === -1)
          this.chunks[chunkId].push(user.uid);
        this.emit("chunk:peers:add", chunkId, user);
      }.bind(this),

      remove: function(user) {
        var peers = this.chunks[chunkId];
        var index = peers.indexOf(user.uid);
        if (index !== -1)
          this.chunks[chunkId].splice(index, 1);
        this.emit("chunk:peers:remove", chunkId, user);
      }.bind(this)
    };
  },

  toJSON: function() {
    return this.chunks;
  }
});

function Hive() {
  this.swarms = {};

  EventEmitter.call(this);
}

inherits(Hive, EventEmitter);

Hive.prototype = extend(Hive.prototype, {
  create: function(swarmId, options) {
    var nbChunks = Math.ceil(options.fileSize / options.chunkSize);
    var swarm, chunks = {};

    for (var i = 0; i < nbChunks; i++)
      chunks[i] = [];

    swarm = new Swarm(swarmId, chunks);
    this.swarms[swarmId] = swarm;
    this.emit("add", swarm);

    return swarm;
  },

  get: function(swarmId) {
    return this.swarms[swarmId];
  }
});

module.exports = Hive;

