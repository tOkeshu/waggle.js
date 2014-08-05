(function() {
  var video = document.querySelector("video");
  var peers = document.querySelector(".peers-connected span");
  var alert = document.querySelector(".alert");
  var waggler;

  if (!window.mozRTCPeerConnection) {
    alert.textContent = [
      "This demo only works with Firefox for now. ",
      "Any contribution to support other browsers would be greatly appreciated"
    ].join('');
    alert.classList.remove("hide");
    return;
  }

  if (!window.MediaSource) {
    alert.textContent = [
      "Your browser does not support MediaSource. ",
      "On Mozilla Firefox you can switch media.mediasource.enabled ",
      "to true in about:config"
    ].join('');
    alert.classList.remove("hide");
    return;
  }

  waggler = new Waggler("foo");

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