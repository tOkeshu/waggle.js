"use strict";

var http = require("http");

var expect = require("chai").expect;
var sinon = require("sinon");
var request = require('request');
var EventSource = require('eventsource');

var BrocastServer = require("../server");
var Rooms = require("../../../webrtc/smoke-signals.git/server/rooms");

var host = "http://localhost:7665";
var req = {
  post: function(params, callback) {
    if ((typeof params) === "string")
      params = {url: params, headers: {}};

    params.url = host + params.url;
    params.headers = params.headers || {};

    if (!params.headers['Content-Type'])
      params.headers['Content-Type'] = "application/json";

    request.post(params, callback);
  }
};

describe("Server", function() {
  var server, sandbox, clock;

  before(function(done) {
    server = new BrocastServer();
    server.run(done);
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    clock = sinon.useFakeTimers();
    server.rooms = new Rooms();
    server.rooms.create("foo", 60000);
  });

  afterEach(function() {
    clock.restore();
    sandbox.restore();
  });

  describe("#register", function() {

    it("should add the user to the swarm", function(done) {
      var fakeConnection = {
        on: function() {},
        sse: function() {}
      };
      var room = server.rooms.get("foo");
      var user = room.users.create(fakeConnection);

      req.post({
        url: '/rooms/foo/files/bar/register',
        body: JSON.stringify({token: user.token}),
      }, function (error, response, body) {
        expect(error).to.equal(null);
        expect(response.statusCode).to.equal(200);

        var swarm = server.hive.get("bar");
        expect(swarm.users.getByUid(user.uid)).to.not.equal(undefined);

        done();
      });

    });

    it("should send the current index to the user", function(done) {
      var source = new EventSource(host + "/rooms/foo");
      var swarm = server.hive.get("bar");

      source.addEventListener("uid", function(event) {
        var message = JSON.parse(event.data);

        req.post({
          url: '/rooms/foo/files/bar/register',
          body: JSON.stringify({token: message.token}),
        }, function (error, response, body) {
          expect(error).to.equal(null);
          expect(response.statusCode).to.equal(200);
        });
      });

      source.addEventListener("indexupdate", function(event) {
        var message = JSON.parse(event.data);

        expect(message).to.deep.equal({index: swarm.toJSON()});

        source.close();
        done();
      });

    });

  });

});
