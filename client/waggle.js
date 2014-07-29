var Waggler = (function() {
  function Peers() {
  }

  function Chunk(id) {
    this.id = parseInt(id);
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

    hasPeers: function() {
      return false;
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

  function Swarm(id, fileUrl) {
    this.id = id;
    this.fileUrl = fileUrl;
    this.chunks = {};
    this.wanted = [];
  }

  Swarm.prototype = {
    setState: function(index) {
      var chunk;
      for (var chunkId in index) {
        chunk = new Chunk(chunkId, this.id);
        chunk.peers = new Set(index[chunkId]);
        chunk.on("data", this.emit.bind(this, "chunk", chunk));

        this.chunks[chunkId] = chunk;
      }

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
          return this.peers[uid][chunkId];
        }
      };
    },

    want: function(chunkId) {
      if (this.wanted.indexOf(chunkId) !== -1)
        return;

      this.wanted.push(chunkId);
      var chunk = this.chunks[chunkId];

      if (chunk)
        this.emit("chunk:wanted", chunk);
    },

    wantedChunks: function() {
      return this.wanted;
    }
  };

  MicroEvent.mixin(Swarm)
  Swarm.prototype.on = Swarm.prototype.bind;
  Swarm.prototype.emit = Swarm.prototype.trigger;

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
    }
  };

  function Videos() {
    this.videos = {};
  }

  Videos.prototype = {
    add: function(fileId, el) {
      var mediaSource = new MediaSource();
      el.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', function() {
        mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
        this.videos[fileId] = mediaSource;
      }.bind(this));

      return el;
    },

    get: function(fileId) {
      return this.videos[fileId];
    }
  };

  function Waggler(room) {
    this.room   = room;
    this.peers  = new Peers();
    this.hive   = new Hive();
    this.videos = new Videos();
    this.me     = undefined;
    this.token  = undefined;

    this.source = new EventSource("/api/rooms/" + this.room);
    this.source.on = this.source.addEventListener.bind(this.source);
    this.source.on("uid", this._onUID.bind(this));
    // this.source.on("offer",        this._onOffer.bind(this));
    // this.source.on("answer",       this._onAnswer.bind(this));
    // this.source.on("icecandidate", this._onIceCandidate.bind(this));
    this.source.on("indexstate",      this._onIndexState.bind(this));
    this.source.on("indexupdate",     this._onIndexUpdated.bind(this));

    // this.peers.on("add", this._setupPeer.bind(this));
  }

  Waggler.prototype = {
    listenFor: function(fileUrl, el) {
      var fileId = "bar"; // btoa(fileUrl);
      this._post('/api/rooms/' + this.room + '/files/' + fileId + '/register');
      this._setupSwarm(this.hive.add(fileId, fileUrl));
      this._setupVideo(this.videos.add(fileId, el), fileId);
    },

    _onUID: function(event) {
      var message = JSON.parse(event.data);
      this.me = message.uid;
      this.token = message.token;
    },

    _onOffer: function(event) {
      // var message = JSON.parse(event.data);
      // var peer = this.peers.add(message.peer);

      // peer.createAnswer(message.offer, function(answer) {
      //   this._signal({
      //     type: 'answer',
      //     peer: peer.id,
      //     payload: {
      //       answer: answer
      //     }
      //   });
      // }.bind(this));;
    },

    _onAnswer: function(event) {
      // var message = JSON.parse(event.data);
      // this.peers.get(message.peer).complete(message.answer, function() {});
    },

    _onIceCandidate: function(event) {
      // var message = JSON.parse(event.data);
      // this.peers.get(message.peer).addIceCandidate(message.candidate);
    },

    _newIceCandidate: function(peer, event) {
      // if (event.candidate) {
      //   this._signal({
      //     type: 'icecandidate',
      //     peer: peer.id,
      //     payload: {
      //       candidate: event.candidate
      //     }
      //   });
      // }
    },

    _onIndexState: function(event) {
      var message = JSON.parse(event.data);
      var swarm = this.hive.get(message.swarm);
      swarm.setState(message.index);
      swarm.want(0);
    },

    _onIndexUpdated: function(event) {
      var message = JSON.parse(event.data);
      var swarm = this.hive.get(message.swarm);
      var chunk = swarm.chunk(message.chunk);

      message.peersToAdd.forEach(function(uid) {
        chunk.availableFrom(uid);
      });
      message.peersToRemove.forEach(function(uid) {
        chunk.notAvailableFrom(uid);
      });
    },

    _setupSwarm: function(swarm) {
      swarm.on("chunk", function(chunk) {
        var mediaSource = this.videos.get(swarm.id);
        mediaSource.sourceBuffers[0].appendBuffer(chunk.data);
        this._post('/api/rooms/' + this.room + '/files/' + swarm.id + '/index', {
          chunk: chunk.id
        });
      }.bind(this));

      swarm.on("chunk:wanted", function(chunk) {
        console.log("we want chunk #" + chunk.id);
        if (chunk.hasPeers())
          this._downloadFromPeers(chunk);
        else
          this._downloadFromServer(swarm.fileUrl, chunk);
      }.bind(this));
    },

    _setupVideo: function(video, swarmId) {
      var swarm = this.hive.get(swarmId);
      // video.on("seek", function() {
      //   // calculate current chunk
      //   swarm.want(chunkId);
      // });

      // video.on("play", function() {
      //   swarm.want(0);
      // });

      video.addEventListener("timeupdate", function() {
        var currentChunkId = parseInt(video.currentTime / 5);
        var nextChunkId = currentChunkId + 1;
        var nextChunk = swarm.chunk(nextChunkId);

        if (nextChunk && !nextChunk.data)
          swarm.want(nextChunkId);
      });
    },

    _setupPeer: function(peer) {
      // peer.on("icecandidate", this._newIceCandidate.bind(this, peer));

      // peer.on("connected", function() {
      //   hive.forEach(function(swarm) {
      //     swarm.wantedChunks().forEach(function(chunkId) {
      //       if (swarm.peer(peer.id).has(chunkId))
      //         peer.request(swarm.id, chunkId);
      //     });
      //   });
      // });

      // peer.on("request", function(swarmId, chunkId) {
      //   var swarm = hive.get(swarmId);
      //   var chunk = swarm.chunk(chunkId);
      //   peer.send(chunk);
      // });

      // peer.on("chunk", function(swarmId, chunkId, data) {
      //   var swarm = hive.get(swarmId);
      //   var chunk = swarm.chunk(chunkId);
      //   chunk.data = data;
      // });
    },

    _downloadFromPeers: function(chunk) {
      // // XXX: peers() should return a sample
      // chunk.peers().forEach(function(uid) {
      //   var peer;

      //   if (this.peers.isConnected(uid)) {
      //     peer = this.peers.get(uid);
      //     peer.request(chunkId);
      //   } if (this.peers.willConnect(uid)) {
      //     peer = this.peers.get(uid);
      //     peer.queueRequest(chunkId);
      //   } else {
      //     peer = this.peers.add(uid);
      //     peer.createOffer(function(offer) {
      //       this._signal({
      //         type: 'offer',
      //         peer: uid,
      //         payload: {
      //           offer: offer
      //         }
      //       });
      //     });
      //   }
      // });
    },

    _downloadFromServer: function(fileUrl, chunk) {
      var xhr = new XMLHttpRequest();

      xhr.onload = function(e) {
        chunk.data = new Uint8Array(xhr.response);
      }.bind(this);

      xhr.open("GET", fileUrl, true);
      console.log("range", chunk.range());
      xhr.setRequestHeader('Range', 'bytes=' + chunk.range());
      xhr.responseType = "arraybuffer";
      xhr.send();
    },

    _post: function(url, message) {
      var xhr = new XMLHttpRequest();
      message = message || {};
      message.token = this.token;

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
      xhr.send(JSON.stringify(message));
    },

    _signal: function(message) {
      this._post('/api/rooms' + this.room, message);
    },
  };

  return Waggler;
}());

