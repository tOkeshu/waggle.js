"use strict";

var http = require("http");

var expect = require("chai").expect;
var sinon = require("sinon");
var request = require('request');
var EventSource = require('eventsource');

var WaggleServer = require("../server");
var Swarm = require("../server");
var Rooms = require("smoke-signals").Rooms;

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
  var server, sandbox;

  before(function(done) {
    server = new WaggleServer();
    server.run(done);
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    server.rooms = new Rooms();
    server.rooms.create("foo", 60000);
    server.hive.create("bar", {fileSize: 9100652, chunkSize: 512 * 1024});
  });

  afterEach(function() {
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

      source.addEventListener("indexstate", function(event) {
        var message = JSON.parse(event.data);

        expect(message).to.deep.equal({
          index: swarm.toJSON(),
          swarm: swarm.id
        });

        source.close();
        done();
      });

    });

  });

  describe("#updateIndex", function() {

    it("should update the index", function(done) {
      var source = new EventSource(host + "/rooms/foo");
      var uid, token;

      source.addEventListener("uid", function(event) {
        var message = JSON.parse(event.data);

        req.post({
          url: '/rooms/foo/files/bar/index',
          body: JSON.stringify({token: message.token, chunk: 0}),
        }, function (error, response, body) {
          expect(error).to.equal(null);
          expect(response.statusCode).to.equal(200);

          var swarm = server.hive.get("bar");
          var index = swarm.chunks[0];
          expect(swarm.chunks[0]).to.deep.equal([message.uid]);

          source.close();
          done();
        });
      });
    });

    it("should notify others the index has been updated", function(done) {
      var user1 = new EventSource(host + "/rooms/foo");
      var user2 = new EventSource(host + "/rooms/foo");

      user1.addEventListener("uid", function(event) {
        var message = JSON.parse(event.data);

        req.post({
          url: '/rooms/foo/files/bar/register',
          body: JSON.stringify({token: message.token}),
        }, function (error, response, body) {
          expect(error).to.equal(null);
          expect(response.statusCode).to.equal(200);

          req.post({
            url: '/rooms/foo/files/bar/index',
            body: JSON.stringify({token: message.token, chunk: 0}),
          }, function (error, response, body) {
            expect(error).to.equal(null);
            expect(response.statusCode).to.equal(200);
          });
        });
      });

      user2.addEventListener("uid", function(event) {
        var message = JSON.parse(event.data);

        req.post({
          url: '/rooms/foo/files/bar/register',
          body: JSON.stringify({token: message.token}),
        }, function (error, response, body) {
          expect(error).to.equal(null);
          expect(response.statusCode).to.equal(200);
        });
      });

      user2.addEventListener("indexupdate", function(event) {
        var message = JSON.parse(event.data);
        var swarm = server.hive.get("bar");

        expect(message).to.deep.equal({
          index: swarm.toJSON(),
          swarm: swarm.id
        });

        user1.close();
        user2.close();
        done();
      });
    });

    it("should avoid duplicates");
  });

});
