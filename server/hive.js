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

var SIZE = 9100652;
var CHUNK_SIZE = 512 * 1024; // 512 kb
var NB_CHUNKS = Math.ceil(SIZE / CHUNK_SIZE);
var chunks = {};
for (var i = 0; i < NB_CHUNKS; i++) {
  chunks[i] = [];
}

function Hive() {
  this.swarms = {bar: new Swarm("bar", chunks)};
}

Hive.prototype = {
  get: function(swarmId) {
    return this.swarms[swarmId];
  }
};

module.exports = Hive;

