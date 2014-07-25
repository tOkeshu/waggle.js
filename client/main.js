(function() {
  var el = document.querySelector("video");
  window.waggler = new Waggler("foo");
  window.waggler.source.on("uid", function() {
    waggler.listenFor(el.dataset.src, el);
  });
}())