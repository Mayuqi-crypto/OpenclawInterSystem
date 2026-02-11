const express = require('express');
const router = express.Router();
const auth = require('../lib/auth');
const memoryStore = require('../services/memory-store');

// Get team memory
router.get('/memory/team', auth.requireAuth, (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.prefix) filter.prefix = req.query.prefix;
  if (req.query.search) filter.search = req.query.search;
  if (req.query.limit) filter.limit = parseInt(req.query.limit);
  res.json({ memories: memoryStore.getTeamMemories(filter) });
});

// Upsert team memory
router.put('/memory/team', auth.requireAuth, (req, res) => {
  const { key, content, category, metadata, importance } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  const memory = memoryStore.upsertTeamMemory({ key, content, category, metadata, importance });
  res.json({ ok: true, memory });
});

// Get agent personal memory
router.get('/memory/agent/:name', auth.requireAuth, (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.prefix) filter.prefix = req.query.prefix;
  if (req.query.search) filter.search = req.query.search;
  if (req.query.limit) filter.limit = parseInt(req.query.limit);
  res.json({ memories: memoryStore.getAgentMemories(req.params.name, filter) });
});

// Upsert agent personal memory
router.put('/memory/agent/:name', auth.requireAuth, (req, res) => {
  const { key, content, category, metadata, importance } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  const memory = memoryStore.upsertAgentMemory(req.params.name, { key, content, category, metadata, importance });
  res.json({ ok: true, memory });
});

// Delete memory entry
router.delete('/memory/:id', auth.requireAuth, (req, res) => {
  memoryStore.deleteMemory(parseInt(req.params.id));
  res.json({ ok: true });
});

// Search all memories
router.get('/memory/search', auth.requireAuth, (req, res) => {
  const { q, scope } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  res.json({ memories: memoryStore.search(q, scope) });
});

module.exports = router;
