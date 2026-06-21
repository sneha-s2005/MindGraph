const express = require('express');
const { runQuery } = require('../db/neo4j');

const router = express.Router();

// Color palette for nodes based on type
const NODE_COLORS = {
  User: '#7c3aed',         // Vibrant Purple
  Mood: '#14b8a6',         // Teal
  Sleep: '#3b82f6',        // Blue
  Exercise: '#10b981',     // Green
  Study: '#eab308',        // Yellow
  Work: '#f97316',         // Orange
  Habit: '#a855f7',        // Light Purple
  Person: '#ec4899',       // Pink
  Goal: '#06b6d4',         // Cyan
  Activity: '#f43f5e',     // Rose
  BurnoutRisk: '#ef4444',  // Red
  Productivity: '#84cc16', // Lime
};

// GET /api/graph/data/:userId
router.get('/data/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Query last 7 days of logs and all connecting nodes and relationships
    const query = `
      MERGE (u:User {id: $userId})
      WITH u
      OPTIONAL MATCH (u)-[r]->(m)
      WHERE m.date >= date() - duration({days: 7}) OR m.date IS NULL OR r.date >= date() - duration({days: 7})
      RETURN u AS user, r AS rel, m AS targetNode, type(r) AS relType, labels(m)[0] AS targetType
    `;
    const records = await runQuery(query, { userId });

    const nodesMap = new Map();
    const links = [];
    const addedLinks = new Set();

    // Add User node by default
    nodesMap.set(userId, {
      id: userId,
      label: 'You (User)',
      type: 'User',
      color: NODE_COLORS.User,
      size: 24,
    });

    records.forEach((rec) => {
      // Add User node properties if returned
      if (rec.user && rec.user.name) {
        nodesMap.set(userId, {
          id: userId,
          label: `${rec.user.name} (User)`,
          type: 'User',
          color: NODE_COLORS.User,
          size: 24,
        });
      }

      if (rec.targetNode && rec.targetType) {
        let targetId = rec.targetNode.id;
        if (!targetId) {
          const nameOrTitle = rec.targetNode.title || rec.targetNode.name || '';
          targetId = `${rec.targetType.toLowerCase()}_${nameOrTitle.replace(/\s+/g, '_')}`;
        }
        let label = rec.targetNode.name || rec.targetNode.title || rec.targetType;

        if (rec.targetType === 'Mood') {
          label = `Mood: ${rec.targetNode.score}/10`;
        } else if (rec.targetType === 'Sleep') {
          label = `Sleep: ${rec.targetNode.hours} hrs`;
        } else if (rec.targetType === 'Exercise') {
          label = `Exercise: ${rec.targetNode.duration}m`;
        } else if (rec.targetType === 'BurnoutRisk') {
          label = `Burnout: ${rec.targetNode.score}/100`;
        } else if (rec.targetType === 'Productivity') {
          label = `Productivity: ${rec.targetNode.score}/100`;
        }

        // Add Target Node
        nodesMap.set(targetId, {
          id: targetId,
          label,
          type: rec.targetType,
          color: NODE_COLORS[rec.targetType] || '#6b7280',
          size: rec.targetType === 'Mood' || rec.targetType === 'BurnoutRisk' ? 18 : 14,
        });

        // Add Link
        const linkId = `link_${userId}_${targetId}_${rec.relType}`;
        if (!addedLinks.has(linkId)) {
          addedLinks.add(linkId);
          links.push({
            id: linkId,
            source: userId,
            target: targetId,
            label: rec.relType,
          });
        }

        // We can also query secondary relationships (e.g., Mood/Productivity influenced by Habits)
        // For simplicity in a 7-day query, we will add connections locally or query them next
      }
    });

    // Fetch secondary relations: Mood and Productivity influenced by Habits/Sleep/Person
    const secondaryQuery = `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[:LOGGED]->(m:Mood)
      WHERE m.date >= date() - duration({days: 7})
      MATCH (m)-[r:INFLUENCED_BY]->(x)
      RETURN m.id AS moodId, type(r) AS relType, x.id AS targetId, labels(x)[0] AS targetType, coalesce(x.name, x.title) AS targetName
    `;
    const secondaryRecords = await runQuery(secondaryQuery, { userId });

    secondaryRecords.forEach((rec) => {
      const moodId = rec.moodId;
      let targetId = rec.targetId;
      const targetType = rec.targetType;

      if (nodesMap.has(moodId) && targetType) {
        if (!targetId) {
          const nameOrTitle = rec.targetName || '';
          targetId = `${targetType.toLowerCase()}_${nameOrTitle.replace(/\s+/g, '_')}`;
        }
        // If the habit/sleep node is not in our active map, add it
        if (!nodesMap.has(targetId)) {
          nodesMap.set(targetId, {
            id: targetId,
            label: rec.targetName || targetType,
            type: targetType,
            color: NODE_COLORS[targetType] || '#6b7280',
            size: 14,
          });
        }
        // Add Link
        const linkId = `link_${moodId}_${targetId}_${rec.relType}`;
        if (!addedLinks.has(linkId)) {
          addedLinks.add(linkId);
          links.push({
            id: linkId,
            source: moodId,
            target: targetId,
            label: rec.relType,
          });
        }
      }
    });

    const nodes = Array.from(nodesMap.values());
    res.json({ nodes, links });

  } catch (err) {
    console.error('Neo4j error in /graph/data:', err.message);
    res.json({
      nodes: [],
      links: [],
      offline: true,
      error: err.message
    });
  }
});

module.exports = router;
