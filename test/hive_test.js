describe("Chunk", function() {

  describe(".data", function() {

    it("should return associated data", function() {
      var chunk = new Chunk(0, "fake swarm id");
      var arraybuffer = new Uint8Array(10);
      chunk.data = arraybuffer;

      expect(chunk.data).to.equal(arraybuffer);
    });

    it("should trigger a data event when updated", function(done) {
      var chunk = new Chunk(0, "fake swarm id");
      var arraybuffer = new Uint8Array(10);
      chunk.on("data", function(data) {
        done();
      });
      chunk.data = arraybuffer;
    });

  });

  describe("#availableFrom", function() {

    it("should update the list of peers the chunk is available from",
       function() {
         var chunk = new Chunk(0, "fake swarm id");
         expect([...chunk.peers]).to.eql([]);
         chunk.availableFrom(1);
         expect([...chunk.peers]).to.eql([1]);
       });

  });

  describe("#notAvailableFrom", function() {

    it("should update the list of peers the chunk is available from",
       function() {
         var chunk = new Chunk(0, "fake swarm id");
         chunk.availableFrom(1);
         expect([...chunk.peers]).to.eql([1]);
         chunk.notAvailableFrom(1);
         expect([...chunk.peers]).to.eql([]);
       });
  });

  describe("#range", function() {

    it("should return a range compliant with the HTTP Range Header",
       function() {
         var chunk = new Chunk(0);
         expect(chunk.range()).to.be("0-524287");
       });

  });

});

describe("Swarm", function() {

  describe("#setState", function() {

    it("should set the initial state of the index", function() {
      var swarm = new Swarm("swarm id");
      var index = {0: [1, 2, 3], 1: []};

      swarm.setState(index);

      expect([...swarm.chunks[0].peers]).to.eql(index[0]);
      expect([...swarm.chunks[1].peers]).to.eql(index[1]);
    });

    it("should emit wanted chunk queued until then", function(done) {
      var swarm = new Swarm("swarm id");
      var index = {0: [], 1: []};
      swarm.wanted = [0];
      swarm.on("chunk:wanted", function(chunk) {
        expect(chunk).to.be(swarm.chunks[0]);
        done();
      });

      swarm.setState(index);
    });

  });

  describe("#chunk", function() {

    it("should return the chunk corresponding to the given id", function() {
      var swarm = new Swarm("swarm id");
      var chunk = new Chunk(0, "swarm id");
      swarm.chunks[0] = chunk;

      expect(swarm.chunk(0)).to.be(chunk);
    });

  });

  describe("#peer", function() {

    describe(".has", function() {

      it("should return true if the chunk id is available from this peer",
         function() {
           var swarm = new Swarm("swarm id");
           var chunk = new Chunk(0, "swarm id");
           chunk.peers = new Set([1]);
           swarm.chunks[0] = chunk;

           expect(swarm.peer(1).has(0)).to.be(true);
         });

      it("should return false if the chunk id is not available from this peer",
         function() {
           var swarm = new Swarm("swarm id");
           var chunk = new Chunk(0, "swarm id");
           chunk.peers = new Set([]);
           swarm.chunks[0] = chunk;

           expect(swarm.peer(1).has(0)).to.be(false);
         });

    });

  });

  describe("#want", function() {

    it("should put the wanted chunk in a queue", function() {
      var swarm = new Swarm("swarm id");
      var chunk = new Chunk(0, "swarm id");
      swarm.chunks = {0: chunk};

      swarm.want(0);

      expect(swarm.wanted).to.eql([0]);
    });

    it("should not allow duplicates", function() {
      var swarm = new Swarm("swarm id");
      var chunk = new Chunk(0, "swarm id");
      swarm.chunks = {0: chunk};

      swarm.want(0);
      swarm.want(0);

      expect(swarm.wanted).to.eql([0]);
    });

    it("should not allow non existant chunks", function() {
      var swarm = new Swarm("swarm id");
      var chunk = new Chunk(0, "swarm id");
      swarm.chunks = {0: chunk};

      swarm.want(1);

      expect(swarm.wanted).to.eql([]);
    });

    it("should emit a chunk:wanted event", function() {
      var swarm = new Swarm("swarm id");
      var chunk = new Chunk(0, "swarm id");
      swarm.chunks = {0: chunk};

      swarm.on("chunk:wanted", function(c) {
        expect(c).to.be(chunk);
      });

      swarm.want(0);
    });
  });

  describe("events", function() {

    it("should remove chunk from the wanted queue once their data" +
       " has been attached", function() {
         var swarm = new Swarm("swarm id");
         var index = {0: [], 1: []};
         swarm.setState(index);
         swarm.want(0);
         expect(swarm.wanted).to.eql([0]);

         swarm.chunks[0].data = new Uint8Array(10);

         expect(swarm.wanted).to.eql([]);
       });

    it("should emit a chunk event once their data has been attached",
       function(done) {
         var swarm = new Swarm("swarm id");
         var index = {0: [], 1: []};
         swarm.setState(index);
         swarm.want(0);
         swarm.on("chunk", function(chunk) {
           expect(chunk).to.be(swarm.chunks[0]);
           done();
         });

         swarm.chunks[0].data = new Uint8Array(10);
       });

  });

});

describe("Hive", function() {

  describe("#add", function() {

    it("should create a new swarm", function() {
      var hive = new Hive();
      var swarm = hive.add("swarm id", "file url");
      expect(hive.get("swarm id")).to.be(swarm);
    });

  });

  describe("#get", function() {

    it("should return the swarm corresponding to the given id", function() {
      var hive = new Hive();
      var swarm = hive.add("swarm id", "file url");
      expect(hive.get("swarm id")).to.be(swarm);
    });

  });

  describe("#forEach", function() {

    it("should iterate on each swarm", function() {
      var hive = new Hive();
      var swarm1 = hive.add("swarm1", "file1 url");
      var swarm2 = hive.add("swarm2", "file2 url");
      var harvested = [];

      hive.forEach(function(swarm) {
        harvested.push(swarm);
      });

      expect(harvested).to.eql([swarm1, swarm2]);
    });

  });

});

