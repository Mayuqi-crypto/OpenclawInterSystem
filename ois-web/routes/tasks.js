const express = require('express');
const router = express.Router();
const auth = require('../lib/auth');
const db = require('../lib/db');

// List tasks
router.get('/tasks', auth.requireAuth, (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignee) filter.assignee = req.query.assignee;
  res.json({ tasks: db.getTasks(filter) });
});

// Get single task
router.get('/tasks/:id', auth.requireAuth, (req, res) => {
  const task = db.getTask(parseInt(req.params.id));
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

// Create task
router.post('/tasks', auth.requireAuth, (req, res) => {
  const { title, assignee, priority, deadline, follow_up_interval } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const task = db.createTask({
    title,
    assignee: assignee || null,
    creator: req.user,
    priority: priority || 'normal',
    deadline: deadline || null,
    follow_up_interval: follow_up_interval || 3600000,
  });
  res.json({ ok: true, task });
});

// Update task
router.put('/tasks/:id', auth.requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.getTask(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const updated = db.updateTask(id, req.body);
  res.json({ ok: true, task: updated });
});

// Delete task
router.delete('/tasks/:id', auth.requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.getTask(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  db.deleteTask(id);
  res.json({ ok: true });
});

module.exports = router;
