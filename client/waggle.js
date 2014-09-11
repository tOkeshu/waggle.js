var Waggler = (function() {
  var QUORUM = 3;
  var WINDOW_SIZE = 10;
  var CHUNK_SIZE = 512 * 1024 // 512 kb;
  var FILE_SIZE = 158367779 // in bytes;
  var VIDEO_DURATION = 734 // in seconds
  var DATA_PER_SECOND = FILE_SIZE / VIDEO_DURATION;

  var take = {
    /**
     * Take *up to* n *distinct* random elements from an array
     *
     * Examples:
     *
     *   take.upTo(3).from([1, 2, 3]); // [3, 1, 2]
     *   take.upTo(4).from([1, 2, 3]); // [2, 1, 3]
     */
    upTo: function(n) {
      return {
        from: function(array) {
          n = Math.min(n, array.length);
          return take.exactly(n).from(array);
        }
      }
    },

    /**
     * Take *exactly* n *distinct* random elements from an array
     *
     * Examples:
     *
     *   take.exactly(3).from([1, 2, 3]); // [3, 1, 2]
     *   take.exactly(4).from([1, 2, 3]); // []
     */
    exactly: function(n) {
      return {
        from: function(array) {
          array = array.slice(0);
          var values, value, index;

          if (array.length < n)
            return [];

          values = [];
          while (n > 0) {
            index = Math.floor(Math.random() * array.length);
            values.push(array[index]);

            array.splice(index, 1);
            n -= 1;
          }

          return values;
        }
      };
    }
  }

  function Waggler(room) {
    this.room   = room;
    this.peers  = new Peers();
    this.hive   = new Hive();
    this.videos = new Videos();
    this.me     = undefined;
    this.token  = undefined;

    this.source = new EventSource("/api/rooms/" + this.room);
    this.source.on = this.source.addEventListener.bind(this.source);
    this.source.on("uid",          this._onUID.bind(this));
    this.source.on("offer",        this._onOffer.bind(this));
    this.source.on("answer",       this._onAnswer.bind(this));
    this.source.on("icecandidate", this._onIceCandidate.bind(this));
    this.source.on("indexstate",   this._onIndexState.bind(this));
    this.source.on("indexupdate",  this._onIndexUpdated.bind(this));
    this.source.on("buddyleft",    this._onPeerLeft.bind(this));

    this.peers.on("add", this._setupPeer.bind(this));
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
      console.log("UID/TOKEN", this.me, this.token);
    },

    _onOffer: function(event) {
      var message = JSON.parse(event.data);
      var peer = this.peers.add(message.peer);

      peer.createAnswer(message.offer, function(answer) {
        this._signal({
          type: 'answer',
          peer: peer.id,
          payload: {
            answer: answer
          }
        });
      }.bind(this));;
    },

    _onAnswer: function(event) {
      var message = JSON.parse(event.data);
      var peer = this.peers.get(message.peer);
      if (!peer)
        return;

      peer.complete(message.answer, function() {});
    },

    _onIceCandidate: function(event) {
      var message = JSON.parse(event.data);
      var peer = this.peers.get(message.peer);
      if (!peer)
        return;

      peer.addIceCandidate(message.candidate);
    },

    _newIceCandidate: function(peer, event) {
      if (event.candidate) {
        this._signal({
          type: 'icecandidate',
          peer: peer.id,
          payload: {
            candidate: event.candidate
          }
        });
      }
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

    _onPeerLeft: function(event) {
      var message = JSON.parse(event.data);
      var uid = message.peer;
      var peer = this.peers.get(uid);

      if (!peer)
        return;

      peer.disconnect();
      this.peers.remove(uid);
      this.emit("peers:disconnected", peer);
    },

    _setupSwarm: function(swarm) {
      swarm.on("chunk", function(chunk) {
        var video = this.videos.get(swarm.id);
        this._post('/api/rooms/' + this.room + '/files/' + swarm.id + '/index', {
          chunk: chunk.id
        });

        video.buffer(chunk);
      }.bind(this));

      swarm.on("chunk:wanted", function(chunk) {
        console.log("we want chunk #" + chunk.id, chunk.peers);
        var candidates = this.peers.in(chunk.peers).reachable();

        if (candidates.length >= QUORUM)
          this._downloadFromPeers(chunk);
        else
          this._downloadFromServer(swarm.fileUrl, chunk);
      }.bind(this));

      // Download the chunk from the server if we did not receive it
      // in less than 2 seconds
      // XXX: what if the chunk takes more that 2 seconds to download
      // from the server?
      swarm.on("chunk:wanted", function(chunk) {
        setTimeout(function() {
          if (!chunk.data)
            this._downloadFromServer(swarm.fileUrl, chunk);
        }.bind(this), 2000);
      }.bind(this));
    },

    _setupVideo: function(video, swarmId) {
      var swarm = this.hive.get(swarmId);

      video.el.addEventListener("timeupdate", function() {
        var time = this.currentTime;
        var currentChunkId, nextChunk;

        currentChunkId = parseInt(time * DATA_PER_SECOND / CHUNK_SIZE);
        for (var i = 1; i < WINDOW_SIZE; i++) {
          nextChunk = swarm.chunk(currentChunkId + i);
          if (nextChunk && !nextChunk.data)
            swarm.want(currentChunkId + i);
        }
      });
    },

    _setupPeer: function(peer) {
      peer.on("icecandidate", this._newIceCandidate.bind(this, peer));

      peer.on("connected", function() {
        console.log("connected with " + peer.id);
        this.hive.forEach(function(swarm) {
          swarm.wanted.forEach(function(chunkId) {
            if (swarm.peer(peer.id).has(chunkId))
              peer.request(swarm.chunk(chunkId));
          });
        });

        this.emit("peers:connected", peer);
      }.bind(this));

      peer.on("disconnected", function() {
        this.peers.remove(peer.id);
        this.emit("peers:disconnected", peer);
      }.bind(this));

      peer.on("unreachable", function() {
        this.peers.remove(peer.id);
        this.peers.unreachable.add(peer.id);
      }.bind(this));

      peer.on("request", function(message) {
        console.log("received request", message);
        var swarm = this.hive.get(message.swarmId);
        var chunk = swarm.chunk(message.chunkId);
        peer.send(chunk);
      }.bind(this));

      peer.on("chunk", function(message) {
        var swarm = this.hive.get(message.swarmId);
        var chunk = swarm.chunk(message.chunkId);

        // We may received the chunk via another peer, so don't
        // bother.
        if (!chunk.data) {
          chunk.data = message.blob;
          this.emit("chunk", chunk, "peers");
          console.log("received chunk", message);
        }
      }.bind(this));
    },

    _downloadFromPeers: function(chunk) {
      var candidates = this.peers.in(chunk.peers).reachable();
      var peers;

      peers = take.upTo(QUORUM)
        .from(this.peers.in(candidates).connected());
      peers.forEach(function(uid) {
        var peer = this.peers.get(uid);
        peer.request(chunk);
      }.bind(this));

      peers = take.exactly(QUORUM - peers.length)
        .from(this.peers.in(candidates).notConnected());
      peers.forEach(function(uid) {
        var peer;

        if (this.peers.get(uid))
          return;

        peer = this.peers.add(uid);
        peer.createOffer(function(offer) {
          this._signal({
            type: 'offer',
            peer: uid,
            payload: {
              offer: offer
            }
          });
        }.bind(this));
      }.bind(this));
    },

    _downloadFromServer: function(fileUrl, chunk) {
      var xhr = new XMLHttpRequest();

      xhr.onload = function(e) {
        if (xhr.status === 206 && !chunk.data) {
          chunk.data = new Uint8Array(xhr.response);
          this.emit("chunk", chunk, "server");
        }
      }.bind(this);

      xhr.open("GET", fileUrl, true);
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
      this._post('/api/rooms/' + this.room, message);
    },
  };

  MicroEvent.mixin(Waggler);
  Waggler.prototype.on = Waggler.prototype.bind;
  Waggler.prototype.emit = Waggler.prototype.trigger;

  return Waggler;
}());

