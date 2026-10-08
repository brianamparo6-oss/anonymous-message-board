const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

const board = 'testboard';

// Create a thread, then fetch it back so we know its _id
function createThread(text, pw, cb) {
  chai.request(server)
    .post('/api/threads/' + board)
    .redirects(0)
    .send({ text: text, delete_password: pw })
    .end(function () {
      chai.request(server)
        .get('/api/threads/' + board)
        .end(function (err, res) {
          cb(res.body[0]);
        });
    });
}

// Add a reply to a thread, then fetch the thread to get the reply's _id
function createReply(threadId, text, pw, cb) {
  chai.request(server)
    .post('/api/replies/' + board)
    .redirects(0)
    .send({ thread_id: threadId, text: text, delete_password: pw })
    .end(function () {
      chai.request(server)
        .get('/api/replies/' + board)
        .query({ thread_id: threadId })
        .end(function (err, res) {
          const replies = res.body.replies;
          cb(replies[replies.length - 1]);
        });
    });
}

suite('Functional Tests', function () {
  this.timeout(10000);

  suite('API ROUTING FOR /api/threads/:board', function () {

    test('Creating a new thread', function (done) {
      chai.request(server)
        .post('/api/threads/' + board)
        .redirects(0)
        .send({ text: 'new thread', delete_password: 'pw' })
        .end(function () {
          chai.request(server)
            .get('/api/threads/' + board)
            .end(function (err, res) {
              assert.equal(res.status, 200);
              assert.equal(res.body[0].text, 'new thread');
              done();
            });
        });
    });

    test('Viewing the 10 most recent threads with 3 replies each', function (done) {
      chai.request(server)
        .get('/api/threads/' + board)
        .end(function (err, res) {
          assert.equal(res.status, 200);
          assert.isArray(res.body);
          assert.isAtMost(res.body.length, 10);
          res.body.forEach(function (t) {
            assert.isAtMost(t.replies.length, 3);
            assert.notProperty(t, 'delete_password');
            assert.notProperty(t, 'reported');
          });
          done();
        });
    });

    test('Deleting a thread with the incorrect password', function (done) {
      createThread('to delete', 'right', function (thread) {
        chai.request(server)
          .delete('/api/threads/' + board)
          .send({ thread_id: thread._id, delete_password: 'wrong' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'incorrect password');
            done();
          });
      });
    });

    test('Deleting a thread with the correct password', function (done) {
      createThread('to delete', 'right', function (thread) {
        chai.request(server)
          .delete('/api/threads/' + board)
          .send({ thread_id: thread._id, delete_password: 'right' })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'success');
            done();
          });
      });
    });

    test('Reporting a thread', function (done) {
      createThread('to report', 'pw', function (thread) {
        chai.request(server)
          .put('/api/threads/' + board)
          .send({ thread_id: thread._id })
          .end(function (err, res) {
            assert.equal(res.status, 200);
            assert.equal(res.text, 'reported');
            done();
          });
      });
    });
  });

  suite('API ROUTING FOR /api/replies/:board', function () {

    test('Creating a new reply', function (done) {
      createThread('thread for reply', 'pw', function (thread) {
        chai.request(server)
          .post('/api/replies/' + board)
          .redirects(0)
          .send({ thread_id: thread._id, text: 'a reply', delete_password: 'pw' })
          .end(function () {
            chai.request(server)
              .get('/api/replies/' + board)
              .query({ thread_id: thread._id })
              .end(function (err, res) {
                assert.equal(res.status, 200);
                assert.equal(res.body.replies.length, 1);
                assert.equal(res.body.replies[0].text, 'a reply');
                done();
              });
          });
      });
    });

    test('Viewing a single thread with all replies', function (done) {
      createThread('thread to view', 'pw', function (thread) {
        createReply(thread._id, 'reply one', 'pw', function () {
          chai.request(server)
            .get('/api/replies/' + board)
            .query({ thread_id: thread._id })
            .end(function (err, res) {
              assert.equal(res.status, 200);
              assert.equal(res.body._id, thread._id);
              assert.isArray(res.body.replies);
              assert.notProperty(res.body, 'delete_password');
              done();
            });
        });
      });
    });

    test('Deleting a reply with the incorrect password', function (done) {
      createThread('thread', 'pw', function (thread) {
        createReply(thread._id, 'reply', 'right', function (reply) {
          chai.request(server)
            .delete('/api/replies/' + board)
            .send({ thread_id: thread._id, reply_id: reply._id, delete_password: 'wrong' })
            .end(function (err, res) {
              assert.equal(res.status, 200);
              assert.equal(res.text, 'incorrect password');
              done();
            });
        });
      });
    });

    test('Deleting a reply with the correct password', function (done) {
      createThread('thread', 'pw', function (thread) {
        createReply(thread._id, 'reply', 'right', function (reply) {
          chai.request(server)
            .delete('/api/replies/' + board)
            .send({ thread_id: thread._id, reply_id: reply._id, delete_password: 'right' })
            .end(function (err, res) {
              assert.equal(res.status, 200);
              assert.equal(res.text, 'success');
              done();
            });
        });
      });
    });

    test('Reporting a reply', function (done) {
      createThread('thread', 'pw', function (thread) {
        createReply(thread._id, 'reply', 'pw', function (reply) {
          chai.request(server)
            .put('/api/replies/' + board)
            .send({ thread_id: thread._id, reply_id: reply._id })
            .end(function (err, res) {
              assert.equal(res.status, 200);
              assert.equal(res.text, 'reported');
              done();
            });
        });
      });
    });
  });
});
