(function() {
  var video = document.querySelector("video");
  var peers = document.querySelector(".peers-connected span");
  var waggler = new Waggler("foo");

  waggler.source.on("uid", function() {
    waggler.listenFor(video.dataset.src, video);
  });

  waggler.source.on("indexstate", function(event) {
    var message = JSON.parse(event.data);
    var squares = document.querySelector(".chunks");
    var square;

    for (var chunkId in message.index) {
      square = document.createElement("div");
      squares.appendChild(square);
    }
  });

  waggler.on("chunk", function(chunk, from) {
    var squares = document.querySelector(".chunks");
    squares.children[chunk.id].classList.add("from-" + from);
  });

  waggler.on("peers:connected", function() {
    peers.textContent = waggler.peers.connected().length;
  });

  waggler.on("peers:disconnected", function() {
    peers.textContent = waggler.peers.connected().length;
  });

  window.waggler = waggler;
}())