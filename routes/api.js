'use strict';
const crypto = require('crypto');

const boards = {}; // board name -> array of threads
const getBoard = name => (boards[name] = boards[name] || []);
const newId = () => crypto.randomUUID();

// Remove private fields before sending to the client
const publicReply = r => ({
  _id: r._id,
  text: r.text,
  created_on: r.created_on
});
const publicThread = (t, limit) => {
  const replies = limit ? t.replies.slice(-limit) : t.replies;
  return {
    _id: t._id,
    text: t.text,
    created_on: t.created_on,
    bumped_on: t.bumped_on,
    replies: replies.map(publicReply),
    replycount: t.replies.length
  };
};

module.exports = function (app) {

  app.route('/api/threads/:board')
    .post((req, res) => {
      const { text, delete_password } = req.body;
      const now = new Date();
      getBoard(req.params.board).push({
        _id: newId(),
        text,
        delete_password,
        created_on: now,
        bumped_on: now,
        reported: false,
        replies: []
      });
      res.redirect('/b/' + req.params.board + '/');
    })
    .get((req, res) => {
      const threads = getBoard(req.params.board)
        .slice()
        .sort((a, b) => b.bumped_on - a.bumped_on)
        .slice(0, 10)
        .map(t => publicThread(t, 3));
      res.json(threads);
    })
    .delete((req, res) => {
      const { thread_id, delete_password } = req.body;
      const board = getBoard(req.params.board);
      const idx = board.findIndex(t => t._id === thread_id);
      if (idx === -1) return res.send('thread not found');
      if (board[idx].delete_password !== delete_password) return res.send('incorrect password');
      board.splice(idx, 1);
      res.send('success');
    })
    .put((req, res) => {
      const id = req.body.thread_id || req.body.report_id;
      const thread = getBoard(req.params.board).find(t => t._id === id);
      if (!thread) return res.send('thread not found');
      thread.reported = true;
      res.send('reported');
    });

  app.route('/api/replies/:board')
    .post((req, res) => {
      const { text, delete_password, thread_id } = req.body;
      const thread = getBoard(req.params.board).find(t => t._id === thread_id);
      if (!thread) return res.send('thread not found');
      const now = new Date();
      thread.replies.push({
        _id: newId(),
        text,
        delete_password,
        created_on: now,
        reported: false
      });
      thread.bumped_on = now;
      res.redirect('/b/' + req.params.board + '/' + thread_id);
    })
    .get((req, res) => {
      const thread = getBoard(req.params.board).find(t => t._id === req.query.thread_id);
      if (!thread) return res.send('thread not found');
      res.json(publicThread(thread));
    })
    .delete((req, res) => {
      const { thread_id, reply_id, delete_password } = req.body;
      const thread = getBoard(req.params.board).find(t => t._id === thread_id);
      if (!thread) return res.send('thread not found');
      const reply = thread.replies.find(r => r._id === reply_id);
      if (!reply) return res.send('reply not found');
      if (reply.delete_password !== delete_password) return res.send('incorrect password');
      reply.text = '[deleted]';
      res.send('success');
    })
    .put((req, res) => {
      const { thread_id, reply_id } = req.body;
      const thread = getBoard(req.params.board).find(t => t._id === thread_id);
      if (!thread) return res.send('thread not found');
      const reply = thread.replies.find(r => r._id === reply_id);
      if (!reply) return res.send('reply not found');
      reply.reported = true;
      res.send('reported');
    });
};
