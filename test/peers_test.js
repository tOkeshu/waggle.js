describe("Peer", function() {
  var encoder = new tnetbin.Encoder({arraybuffer: true});
  var sandbox, clock;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe("#request", function() {

    it("should send a request message to the wire", function() {
      var peer = new Peer(0);
      var chunk = new Chunk(0, "fake swarm id");
      var expectedPayload, call;
      peer.dc = {readyState: "open", send: sinon.spy()};

      peer.request(chunk);

      expectedPayload = encoder.encode({
        type: "request",
        swarmId: "fake swarm id",
        chunkId: 0
      });
      call = peer.dc.send.calledWithExactly(expectedPayload);
      expect(call).to.be.ok();
    });

    it("should queue the message if the datachannel is not open", function() {
      var peer = new Peer(0);
      var chunk = new Chunk(0, "fake swarm id");
      peer.dc = {readyState: "connecting", send: sinon.spy()};

      peer.request(chunk);

      expect(peer.dc.send.called).to.not.be(true);
      expect(peer.queue).to.have.length(1);
    });

  });

  describe("#send", function() {

    it("should send binary data to the wire", function() {
      var peer = new Peer(0);
      var chunk = new Chunk(0, "fake swarm id");
      var message, blob, expectedPayload, call;
      peer.dc = {readyState: "open", send: sinon.spy()};
      chunk.data = new Uint8Array(10);

      peer.send(chunk);

      message = encoder.encode({
        type: "chunk",
        swarmId: "fake swarm id",
        chunkId: 0
      });
      blob = encoder.encode(chunk.data);
      expectedPayload = tnetbin.concatArrayBuffers([message, blob])
      call = peer.dc.send.calledWithExactly(expectedPayload);
      expect(call).to.be.ok();
    });

  });

  describe("#createOffer", function() {

    it("should trigger the callback with an offer", function(done) {
      var peer = new Peer(0);

      peer.createOffer(function(offer) {
        expect(offer).to.be.a(RTCSessionDescription);
        done();
      });
    });

    it("should set the local description with the offer", function(done) {
      var peer = new Peer(0);
      sandbox.spy(peer.pc, "setLocalDescription");

      peer.createOffer(function(offer) {
        var call =
          peer.pc.setLocalDescription.calledWith(offer, sinon.match.func);
        expect(call).to.be.ok();
        done();
      });
    });

  });

  describe("#createAnswer", function() {

    it("should trigger the callback with an answer", function(done) {
      var peer1 = new Peer(0);
      var peer2 = new Peer(1);

      peer1.createOffer(function(offer) {
        peer2.createAnswer(offer, function(answer) {
          expect(answer).to.be.a(RTCSessionDescription);
          done();
        });
      });
    });

    it("should set the local description with the answer", function(done) {
      var peer1 = new Peer(0);
      var peer2 = new Peer(1);
      sandbox.spy(peer2.pc, "setLocalDescription");

      peer1.createOffer(function(offer) {
        peer2.createAnswer(offer, function(answer) {
          var call =
            peer2.pc.setLocalDescription.calledWith(answer, sinon.match.func);
          expect(call).to.be.ok();
          done();
        });
      });
    });

    it("should set the remote description with the offer", function(done) {
      var peer1 = new Peer(0);
      var peer2 = new Peer(1);
      sandbox.spy(peer2.pc, "setRemoteDescription");

      peer1.createOffer(function(offer) {
        peer2.createAnswer(offer, function(answer) {
          var call =
            peer2.pc.setRemoteDescription.calledWith(offer, sinon.match.func);
          expect(call).to.be.ok();
          done();
        });
      });
    });

  });

  describe("#complete", function() {

    it("should set the remote description with the answer", function(done) {
      var peer1 = new Peer(0);
      var peer2 = new Peer(1);
      sandbox.spy(peer1.pc, "setRemoteDescription");

      peer1.createOffer(function(offer) {
        peer2.createAnswer(offer, function(answer) {
          peer1.complete(answer, function() {
            var call = peer1.pc.setRemoteDescription
              .calledWith(answer, sinon.match.func);
            expect(call).to.be.ok();
            done();
          });
        });
      });
    });

  });

  describe("#addIceCandidate", function() {

    it("should add the candidate to the peer connection", function() {
      var peer = new Peer(0);
      var candidate = new RTCIceCandidate().toJSON();
      var call;
      sandbox.stub(window, "RTCIceCandidate").returns(candidate);
      sandbox.stub(peer.pc, "addIceCandidate");

      peer.addIceCandidate(candidate);

      call = peer.pc.addIceCandidate.calledWithExactly(candidate);
      expect(call).to.be.ok();
    });

  });

  describe("#isConnected", function() {

    it("should return true if ice is connected", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "connected"};

      expect(peer.isConnected()).to.be(true);
    });

    it("should return true if ice is completed", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "completed"};

      expect(peer.isConnected()).to.be(true);
    });

    it("should return false if ice did not start", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "new"};

      expect(peer.isConnected()).to.be(false);
    });

    it("should return false if ice failed", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "failed"};

      expect(peer.isConnected()).to.be(false);
    });

    it("should return false if the peer connection disconnected", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "disconnected"};

      expect(peer.isConnected()).to.be(false);
    });

    it("should return false if the peer connection closed", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "closed"};

      expect(peer.isConnected()).to.be(false);
    });

  });

  describe("#willConnect", function() {

    it("should return true if ice is checking", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "checking"};

      expect(peer.willConnect()).to.be(true);
    });

    it("should return false if ice did not start", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "new"};

      expect(peer.willConnect()).to.be(false);
    });

    it("should return false if ice is connected", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "connected"};

      expect(peer.willConnect()).to.be(false);
    });

    it("should return false if ice is completed", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "completed"};

      expect(peer.willConnect()).to.be(false);
    });

    it("should return false if ice failed", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "failed"};

      expect(peer.willConnect()).to.be(false);
    });

    it("should return false if the peer connection disconnected", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "disconnected"};

      expect(peer.willConnect()).to.be(false);
    });

    it("should return false if the peer connection closed", function() {
      var peer = new Peer(0);
      peer.pc = {iceConnectionState: "closed"};

      expect(peer.willConnect()).to.be(false);
    });
  });

  describe("#disconnect", function() {

    it("should close the peer connection", function() {
      var peer = new Peer(0);
      var call;
      sandbox.stub(peer.pc, "close");

      peer.disconnect();

      expect(peer.pc.close.called).to.be(true);
    });

    it("should close the datachannel as well", function() {
      var peer = new Peer(0);
      var call;
      sandbox.stub(peer.dc, "close");
      sandbox.stub(peer.pc, "close");

      peer.disconnect();

      expect(peer.dc.close.called).to.be(true);
    });

  });

  describe("events", function() {

    it("should trigger a failure event if ice failed", function(done) {
      var fakePeerConnection = {createDataChannel: function() { return {};}};
      var peer;
      sandbox.stub(window, "RTCPeerConnection").returns(fakePeerConnection);
      peer = new Peer(0);
      peer.pc.iceConnectionState = "failed";
      peer.on("failure", function() {
        done();
      });

      peer.pc.oniceconnectionstatechange();
    });

    it("should trigger a connected event if ice connected", function(done) {
      var fakePeerConnection = {createDataChannel: function() { return {};}};
      var peer;
      sandbox.stub(window, "RTCPeerConnection").returns(fakePeerConnection);
      peer = new Peer(0);
      peer.pc.iceConnectionState = "connected";
      peer.on("connected", function() {
        done();
      });

      peer.pc.oniceconnectionstatechange();
    });

    it("should trigger a disconnect event when " +
       "the peer connection was disconnected", function(done) {
         var fakePeerConnection = {createDataChannel: function() { return {};}};
         var peer;
         sandbox.stub(window, "RTCPeerConnection").returns(fakePeerConnection);
         peer = new Peer(0);
         peer.pc.iceConnectionState = "disconnected";
         peer.on("disconnected", function() {
           done();
         });

         peer.pc.oniceconnectionstatechange();
       });

    it("should trigger a disconnect event when " +
       "the peer connection was closed", function(done) {
         var fakePeerConnection = {createDataChannel: function() { return {};}};
         var peer;
         sandbox.stub(window, "RTCPeerConnection").returns(fakePeerConnection);
         peer = new Peer(0);
         peer.pc.iceConnectionState = "closed";
         peer.on("disconnected", function() {
           done();
         });

         peer.pc.oniceconnectionstatechange();
       });

    it("should trigger a disconnect event when " +
       "the datachannel was closed", function(done) {
         var fakePeerConnection = {createDataChannel: function() { return {};}};
         var peer;
         sandbox.stub(window, "RTCPeerConnection").returns(fakePeerConnection);
         peer = new Peer(0);
         peer.on("disconnected", function() {
           done();
         });

         peer.dc.onclose();
       });

    it("should trigger an icecandidate event when " +
       "the ice raises a new candidate", function(done) {
         var fakePeerConnection = {createDataChannel: function() { return {};}};
         var fakeCandidate = "fake candidate";
         var peer;
         sandbox.stub(window, "RTCPeerConnection").returns(fakePeerConnection);
         peer = new Peer(0);
         peer.on("icecandidate", function(candidate) {
           expect(candidate).to.equal(fakeCandidate);
           done();
         });

         peer.pc.onicecandidate(fakeCandidate);
       });

    it("should trigger a custom event when receiving messages from a peer",
       function(done) {
         var data = {type: "an event", other: "data"};
         var event = {data: encoder.encode(data)};
         var peer = new Peer(0);
         peer.on("an event", function(message) {
           expect(message).to.eql({
             type: "an event",
             other: "data",
             blob: undefined
           });
           done();
         });
         peer.dc.onmessage(event);
       });

    it("should trigger an event with a blob when receiving binary data" +
       "from a peer", function(done) {
         var message = encoder.encode({type: "an event", other: "data"});
         var arraybuffer = new Uint8Array(10);
         var blob = encoder.encode(arraybuffer);
         var event = {data: tnetbin.concatArrayBuffers([message,blob])};
         var peer = new Peer(0);
         peer.on("an event", function(message) {
           expect(message).to.eql({
             type: "an event",
             other: "data",
             blob: arraybuffer
           });
           done();
         });
         peer.dc.onmessage(event);
       });

    before(function() {
      clock = sinon.useFakeTimers();
    });

    after(function() {
      clock.restore();
    });

    it("should trigger an unreachable event when the peer timeouts",
       function(done) {
         var peer = new Peer(0);
         peer.on("unreachable", function() {
           clock.restore();
           done();
         });

         peer.createOffer(function() {});
         clock.tick(Peer.TIMEOUT * 1000 + 10);
       });

  });
});

describe("Peers", function() {
  var peers, sandbox, clock;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    peers = new Peers();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe("#get", function() {

    it("should returns a Peer object", function() {
      var peer = peers.add(0);
      expect(peers.get(0)).to.be(peer);
    });

  });

  describe("#add", function() {

    it("should create a new Peer with the given id", function() {
      var peer = peers.add(0);
      expect(peer.id).to.be(0);
    });

    it("should trigger an add event", function() {
      var peer, addedPeer;
      peers.on("add", function(p) {
        addedPeer = p;
      });

      peer = peers.add(0);
      expect(addedPeer).to.be(peer);
    });
  });

  describe("#remove", function() {

    it("should remove the peer corresponding to the given id", function() {
      peers.add(0);
      expect(peers.get(0)).to.not.be(undefined);
      peers.remove(0);
      expect(peers.get(0)).to.be(undefined);
    });

  });

  describe("#in", function() {

    describe(".connected", function() {

      it("should return only a subset of connected peers", function() {
        var peer1 = peers.add(1);
        var peer2 = peers.add(2);
        sandbox.stub(peer2, "isConnected").returns(true);

        expect(peers.in([1, 2, 3]).connected()).to.eql([2]);
      });

    });

    describe(".notConnected", function() {

      it("should return only a subset of non connected peers", function() {
        var peer1 = peers.add(1);
        var peer2 = peers.add(2);
        sandbox.stub(peer2, "isConnected").returns(true);
        sandbox.stub(peer1, "willConnect").returns(true);

        expect(peers.in([1, 2, 3]).notConnected()).to.eql([3]);
      });
    });

    describe(".reachable", function() {

      it("should return only a subset of reachable peers", function() {
        var peer1 = peers.add(1);
        var peer2 = peers.add(2);
        peers.unreachable.add(1);

        expect(peers.in([1, 2, 3]).reachable()).to.eql([2, 3]);
      });
    });
  });

  describe("#isConnected", function() {

    it("should return true if the peer is connected", function() {
      var peer1 = peers.add(1);
      sandbox.stub(peer1, "isConnected").returns(true);

      expect(peers.isConnected(1)).to.be(true);
    });

    it("should return false if the peer is not connected", function() {
      var peer1 = peers.add(1);
      sandbox.stub(peer1, "isConnected").returns(false);

      expect(peers.isConnected(1)).to.be(false);
    });

    it("should return false if the peer is not in the list", function() {
      expect(peers.isConnected(1)).to.be(false);
    });

  });

  describe("#willConnect", function() {

    it("should return true if the peer will connect", function() {
      var peer1 = peers.add(1);
      sandbox.stub(peer1, "willConnect").returns(true);

      expect(peers.willConnect(1)).to.be(true);
    });

    it("should return false if the peer won't connect", function() {
      var peer1 = peers.add(1);
      sandbox.stub(peer1, "willConnect").returns(false);

      expect(peers.willConnect(1)).to.be(false);
    });

    it("should return false if the peer is not in the list", function() {
      expect(peers.willConnect(1)).to.be(false);
    });

  });

  describe("#connected", function() {

    it("should return the list of connected peers", function() {
      var peer1 = peers.add(1);
      var peer2 = peers.add(2);
      sandbox.stub(peer1, "isConnected").returns(true);
      sandbox.stub(peer2, "isConnected").returns(true);

      expect(peers.connected()).to.eql([1, 2]);
    });

  });

  describe("#forEach", function() {

    it("should iterate on each peer", function() {
      var peer1 = peers.add(1);
      var peer2 = peers.add(2);
      var harvested = [];

      peers.forEach(function(peer) {
        harvested.push(peer);
      });
      expect(harvested).to.eql([peer1, peer2]);
    });

  });
});

