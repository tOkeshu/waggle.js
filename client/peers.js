var Peers = (function() {
  var encoder = new tnetbin.Encoder({arraybuffer: true});
  var decoder = new tnetbin.Decoder();
  var blobDecoder = new tnetbin.Decoder({arraybuffer: true});

  function Peer(id, config) {
    var pc = new RTCPeerConnection({
      iceServers: [{
        // please contact me if you plan to use this server
        url: 'turn:webrtc.monkeypatch.me:6424?transport=udp',
        credential: 'hibuddy',
        username: 'hibuddy'
      }]
    });
    var dc;

    pc.oniceconnectionstatechange = this._onIceStateChange.bind(this);
    pc.onicecandidate = function(event) {
      this.trigger("icecandidate", event);
    }.bind(this);
    dc = pc.createDataChannel("waggle", {id: 0, negotiated: true});
    dc.onopen = this._onDatachannelOpen.bind(this);
    dc.onmessage = this._onMessage.bind(this);
    dc.onclose = this.trigger.bind(this, "disconnected");
    dc.binaryType = "arraybuffer";

    this.id = id;
    this.pc = pc;
    this.dc = dc;
    this.queue = [];
  }

  Peer.prototype = {
    request: function(chunk) {
      console.log("request chunk #" + chunk.id + " from " + this.id);

      this._send({
        type: "request",
        swarmId: chunk.swarm,
        chunkId: chunk.id
      });
    },

    send: function(chunk) {
      this._send({
        type: "chunk",
        swarmId: chunk.swarm,
        chunkId: chunk.id
      }, chunk.data);
    },

    createOffer: function(callback) {
      console.log("createoffer");
      this.pc.createOffer(function(offer) {
        this.pc.setLocalDescription(offer, function() {
          callback(offer);
        });
      }.bind(this), function() {});
    },

    createAnswer: function(offer, callback) {
      offer = new RTCSessionDescription(offer);
      this.pc.setRemoteDescription(offer, function() {
        this.pc.createAnswer(function(answer) {
          this.pc.setLocalDescription(answer, function() {
            callback(answer)
          });
        }.bind(this), function() {});
      }.bind(this), function() {});
    },

    complete: function(answer, callback) {
      answer = new RTCSessionDescription(answer);
      this.pc.setRemoteDescription(answer, callback);
    },

    addIceCandidate: function(candidate) {
      candidate = new RTCIceCandidate(candidate);
      this.pc.addIceCandidate(candidate);
    },

    isConnected: function() {
      var iceState = this.pc.iceConnectionState;
      if (iceState === "connected" ||
          iceState === "completed")
        return true;

      return false;
    },

    willConnect: function() {
      var iceState = this.pc.iceConnectionState;
      if (iceState === "new" ||
          iceState === "checking")
        return true;

      return false;
    },

    disconnect: function() {
      if (this.dc)
        this.dc.close();
      this.pc.close();
    },

    _onIceStateChange: function() {
      // XXX: display an error if the ice connection failed
      console.log("ice: " + this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === "failed") {
        console.error("Something went wrong: the connection failed");
        this.trigger("failure");
      }

      if (this.pc.iceConnectionState === "connected")
        this.trigger("connected");
      if (this.pc.iceConnectionState === "disconnected" ||
          this.pc.iceConnectionState === "closed")
        this.trigger("diconnected");
    },

    _send: function(message, blob) {
      if (this.dc.readyState === "connecting") {
        this.queue.push([message, blob]);
        return;
      }

      message = encoder.encode(message);
      blob = blob ? encoder.encode(blob) : new Uint8Array(0);
      // TODO: handle errors when the datachannel is closed
      this.dc.send(tnetbin.concatArrayBuffers([message, blob]));
    },

    _onDatachannelOpen: function() {
      var item, message, blob;
      while (this.queue.length > 0) {
        item = this.queue.shift();
        message = item[0];
        blob = item[1];
        this._send(message, blob);
      }
    },

    _onMessage: function(event) {
      var payload, message, remain;

      payload = decoder.decode(event.data);
      message = payload.value;
      remain = payload.remain;

      if (remain) {
        payload = blobDecoder.decode(remain);
        message.blob = payload.value;
      } else
        message.blob = undefined

      this.trigger(message.type, message);
    }
  };

  MicroEvent.mixin(Peer);
  Peer.prototype.on = Peer.prototype.bind;


  function Peers(config) {
    this.peers = {};
  }

  Peers.prototype = {
    get: function(id) {
      return this.peers[id];
    },

    add: function(id) {
      var peer = new Peer(id);
      this.peers[id] = peer;
      this.trigger("add", peer);
      return peer;
    },

    remove: function(id) {
      delete this.peers[id];
    },

    in: function(peers) {
      peers = [...peers];
      return {
        connected: function() {
          return peers.reduce(function(acc, uid) {
            if (this.isConnected(uid))
              acc.push(uid);
            return acc;
          }.bind(this), []);
        }.bind(this),

        notConnected: function() {
          return peers.reduce(function(acc, uid) {
            if (!this.isConnected(uid))
              acc.push(uid);
            return acc;
          }.bind(this), []);
        }.bind(this)
      };
    },

    isConnected: function(id) {
      var peer = this.peers[id];
      if (!peer)
        return false;

      var iceState = peer.pc.iceConnectionState;
      if (iceState === "failed" ||
          iceState === "disconnected" ||
          iceState === "closed")
        return false;

      return peer.pc.iceConnectionState === "connected";
    },

    connected: function() {
      return this.in(Object.keys(this.peers)).connected();
    },

    forEach: function(callback) {
      Object.keys(this.peers).forEach(function(id) {
        callback(this.peers[id]);
      }.bind(this));
    }
  };

  MicroEvent.mixin(Peers);
  Peers.prototype.on = Peers.prototype.bind;

  return Peers;
}());
