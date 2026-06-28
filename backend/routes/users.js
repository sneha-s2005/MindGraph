const express = require('express');
const { v4: uuidv4 } = require('crypto');
const { runQuery } = require('../db/neo4j');

const router = express.Router();

// POST /api/users/create
router.post('/create', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const createdAt = new Date().toISOString();

  const cypher = `
    MERGE (u:User { email: $email })
    ON CREATE SET
      u.id = $userId,
      u.name = $name,
      u.createdAt = $createdAt
    ON MATCH SET
      u.name = $name
    RETURN u.id AS userId, u.name AS name, u.email AS email
  `;

  try {
    const records = await runQuery(cypher, { userId, name, email, createdAt });
    const user = records[0];
    res.json({
      userId: user.userId,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    // If Neo4j is not available, return a local userId so app still works
    console.error('Neo4j error in /users/create:', err.message);
    res.json({ userId, name, email, offline: true });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const cypher = 'MATCH (u:User {email: $email}) RETURN u.id AS userId, u.name AS name, u.email AS email';
    const records = await runQuery(cypher, { email: email.toLowerCase().trim() });
    
    if (records.length === 0) {
      return res.status(404).json({ error: 'No profile found with this email address.' });
    }
    
    res.json(records[0]);
  } catch (err) {
    console.error('Neo4j error in /users/login:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:userId — Get user profile
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const records = await runQuery(
      'MATCH (u:User {id: $userId}) RETURN u.name AS name, u.email AS email',
      { userId }
    );
    if (records.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(records[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:userId/reset — Delete all user nodes, relationships, and user profile
router.delete('/:userId/reset', async (req, res) => {
  const { userId } = req.params;
  try {
    const cypher = `
      MATCH (u:User {id: $userId})
      OPTIONAL MATCH (u)-[:LOGGED]->(m:Mood)
      OPTIONAL MATCH (u)-[:SLEPT]->(sl:Sleep)
      OPTIONAL MATCH (u)-[:EXERCISED]->(ex:Exercise)
      OPTIONAL MATCH (u)-[:STUDIED]->(st:Study)
      OPTIONAL MATCH (u)-[:WORKED]->(wk:Work)
      OPTIONAL MATCH (u)-[:HAS_BURNOUT_RISK]->(br:BurnoutRisk)
      OPTIONAL MATCH (u)-[:HAS_PRODUCTIVITY]->(prod:Productivity)
      DETACH DELETE u, m, sl, ex, st, wk, br, prod
      WITH 1 AS dummy
      OPTIONAL MATCH (p:Person) WHERE NOT (p)--() DELETE p
      WITH 1 AS dummy
      OPTIONAL MATCH (act:Activity) WHERE NOT (act)--() DELETE act
      WITH 1 AS dummy
      OPTIONAL MATCH (g:Goal) WHERE NOT (g)--() DELETE g
    `;
    await runQuery(cypher, { userId });
    res.json({ success: true, message: 'All user data deleted from Neo4j.' });
  } catch (err) {
    console.error('Failed to reset user in Neo4j:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
