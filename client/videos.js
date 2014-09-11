var Video = (function() {
  function Video(el) {
    this.mediaSource = new MediaSource();
    this.queue = [];
    this.el = el;
    this._lastChunkSeen = null;

    this.mediaSource.addEventListener('sourceopen', function() {
      this.mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
    }.bind(this));

    this.el.src = URL.createObjectURL(this.mediaSource);
  }

  Video.prototype = {
    buffer: function(chunk) {
      // First chunk
      if (this._lastChunkSeen === null) {
        this.mediaSource.sourceBuffers[0].appendBuffer(chunk.data);
        this._lastChunkSeen = chunk;
        return;
      }

      if (chunk.id <= this._lastChunkSeen.id)
        throw new Error("WTF");

      if (chunk.id > this._lastChunkSeen.id + 1) {
        this.queue.push(chunk);
        this.queue.sort(function(c1, c2) {
          return c1.id - c2.id;
        });
        return;
      }

      this.queue.reduce(function(acc, chunk) {
        var lastChunk = acc[acc.length - 1];

        if ((lastChunk.id + 1) === (chunk.id))
          acc.push(chunk);

        return acc;
      }, [chunk]).forEach(function(chunk) {
        this.mediaSource.sourceBuffers[0].appendBuffer(chunk.data);
        this._lastChunkSeen = chunk;
      }.bind(this));

      this.queue = this.queue.filter(function(chunk) {
        return chunk.id > this._lastChunkSeen.id;
      }.bind(this));
    }
  }

  return Video;
}());

var Videos = (function() {
  function Videos() {
    this.videos = {};
  }

  Videos.prototype = {
    add: function(fileId, el) {
      var video = new Video(el);
      this.videos[fileId] = video;
      return video;
    },

    get: function(fileId) {
      return this.videos[fileId];
    }
  };

  return Videos;
}());

