(function() {
  var el = document.querySelector("video");
  window.brocaster = new Brocaster("foo");
  window.brocaster.source.on("uid", function() {
    brocaster.listenFor(el.dataset.src, el);
  });
}())