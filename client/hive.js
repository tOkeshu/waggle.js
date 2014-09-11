var Chunk = (function() {
  function Chunk(id, swarm) {
    this.id = parseInt(id);
    this.swarm = swarm;
    this.peers = new Set();
  }

  Chunk.prototype = {
    get data(){
      return this._data;
    },

    set data(d){
      this._data = d;
      this.emit("data");
    },

    availableFrom: function(uid) {
      this.peers.add(uid);
    },

    notAvailableFrom: function(uid) {
      this.peers.delete(uid);
    },

    range: function() {
      var size =  (512 * 1024); // 512 kb
      var start = this.id * size;
      var end = start + size - 1;
      return start + '-' + end;
    }
  };

  MicroEvent.mixin(Chunk)
  Chunk.prototype.on = Chunk.prototype.bind;
  Chunk.prototype.emit = Chunk.prototype.trigger;

  return Chunk;
}());

var Swarm = (function() {
  function Swarm(id, fileUrl) {
    this.id = id;
    this.fileUrl = fileUrl;
    this.chunks = {};
    this.wanted = [];
  }

  Swarm.prototype = {
    setState: function(index) {
      Object.keys(index).forEach(function(chunkId) {
        var chunk = this._setupChunk(new Chunk(chunkId, this.id));
        chunk.peers = new Set(index[chunkId]);
        this.chunks[chunkId] = chunk;
      }.bind(this));

      this.wanted.forEach(function(chunkId) {
        var chunk = this.chunks[chunkId];
        this.emit("chunk:wanted", chunk);
      }.bind(this));
    },

    chunk: function(chunkId) {
      return this.chunks[chunkId];
    },

    peer: function(uid) {
      return {
        has: function(chunkId) {
          return this.chunks[chunkId].peers.has(uid);
        }.bind(this)
      };
    },

    want: function(chunkId) {
      if (this.wanted.indexOf(chunkId) !== -1)
        return;

      if (!this.chunks[chunkId])
        return;

      this.wanted.push(chunkId);
      var chunk = this.chunks[chunkId];

      if (chunk)
        this.emit("chunk:wanted", chunk);
    },

    _setupChunk: function(chunk) {
      chunk.on("data", function() {
        this.wanted = this.wanted.filter(function(chunkId) {
          return chunkId !== chunk.id;
        });
      }.bind(this));
      chunk.on("data", this.emit.bind(this, "chunk", chunk));

      return chunk;
    }
  };

  MicroEvent.mixin(Swarm)
  Swarm.prototype.on = Swarm.prototype.bind;
  Swarm.prototype.emit = Swarm.prototype.trigger;

  return Swarm;
}())

var Hive = (function() {
  function Hive() {
    this.swarms = {};
  }

  Hive.prototype = {
    add: function(swarmId, fileUrl) {
      var swarm = new Swarm(swarmId, fileUrl);
      this.swarms[swarmId] = swarm;
      return swarm;
    },

    get: function(swarmId) {
      return this.swarms[swarmId];
    },

    forEach: function(callback) {
      Object.keys(this.swarms).forEach(function(swarmId) {
        callback(this.swarms[swarmId]);
      }.bind(this));
    }
  };

  return Hive;
}());

