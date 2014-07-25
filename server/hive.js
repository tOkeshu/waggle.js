var Users = require("smoke-signals").Users;

function Swarm(id, chunks) {
  this.id = id;
  this.chunks = chunks;

  this.users = new Users();
}

Swarm.prototype = {
  chunk: function(chunkId) {
    return {
      availableFrom: function(uid) {
        var peers = this.chunks[chunkId];
        if (peers && peers.indexOf(uid) === -1)
          this.chunks[chunkId].push(uid);
      }.bind(this)
    };
  },

  toJSON: function() {
    return this.chunks;
  }
};

function Hive() {
  this.swarms = {};
}

Hive.prototype = {
  create: function(swarmId, options) {
    var nbChunks = Math.ceil(options.fileSize / options.chunkSize);
    var swarm, chunks = {};

    for (var i = 0; i < nbChunks; i++)
      chunks[i] = [];

    swarm = new Swarm(swarmId, chunks);
    this.swarms[swarmId] = swarm;
    return swarm;
  },

  get: function(swarmId) {
    return this.swarms[swarmId];
  }
};

module.exports = Hive;

