const express = require('express');
const { runQuery } = require('../db/neo4j');

const router = express.Router();

// POST /api/mood/log
router.post('/log', async (req, res) => {
  const {
    userId,
    userName = 'Friend',
    score,
    energyLevel = 'Medium',
    sleepHours = 7,
    exerciseDuration = 0,
    studyHours = 0,
    workHours = 0,
    socialInteraction = '',
    stressLevel = 'Medium',
    goalTitle = '',
    activityName = '',
    notes = '',
    habits = {}
  } = req.body;

  if (!userId || score === undefined || score === null) {
    return res.status(400).json({ error: 'userId and score are required' });
  }

  const today = req.body.date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = req.body.date ? `${req.body.date}T12:00:00.000Z` : new Date().toISOString();

  // 1. Calculate Burnout Risk (0-100)
  let burnoutScore = 0;
  const numericMood = parseFloat(score);
  if (numericMood < 5) burnoutScore += 30;
  else if (numericMood < 7) burnoutScore += 15;

  const numericSleep = parseFloat(sleepHours);
  if (numericSleep < 6) burnoutScore += 25;
  else if (numericSleep < 7) burnoutScore += 10;

  if (stressLevel === 'High') burnoutScore += 25;
  else if (stressLevel === 'Medium') burnoutScore += 10;

  if (energyLevel === 'Low') burnoutScore += 20;

  let completedCount = 0;
  const totalHabits = 4;
  if (habits.sleep) completedCount++;
  if (habits.exercise) completedCount++;
  if (habits.meditation) completedCount++;
  if (habits.deepWork) completedCount++;
  
  const skipRate = (totalHabits - completedCount) / totalHabits;
  burnoutScore += skipRate * 20;
  burnoutScore = Math.min(Math.round(burnoutScore), 100);

  // 2. Calculate Productivity Score (0-100)
  const totalFocusHours = parseFloat(workHours || 0) + parseFloat(studyHours || 0);
  const focusPct = Math.min(totalFocusHours / 8, 1); // target is 8 focus hours

  let prodMultiplier = 1;
  if (energyLevel === 'Low') prodMultiplier -= 0.2;
  if (stressLevel === 'High') prodMultiplier -= 0.2;

  const habitMult = 0.5 + (completedCount / totalHabits) * 0.5;
  let sleepMult = 1;
  if (numericSleep < 6) sleepMult = 0.7;
  else if (numericSleep < 7) sleepMult = 0.9;

  let productivityScore = focusPct * 100 * prodMultiplier * habitMult * sleepMult;
  productivityScore = Math.min(Math.max(Math.round(productivityScore), 0), 100);

  // 3. Unique IDs
  const idPrefix = Date.now().toString(36);
  const moodId = `mood_${idPrefix}`;
  const sleepId = `sleep_${idPrefix}`;
  const exerciseId = `exercise_${idPrefix}`;
  const studyId = `study_${idPrefix}`;
  const workId = `work_${idPrefix}`;
  const burnoutId = `burnout_${idPrefix}`;
  const prodId = `prod_${idPrefix}`;

  try {
    // 4. Cleanup old nodes and relationships for this date to prevent duplicate node accumulation
    await runQuery(
      `
      MERGE (u:User {id: $userId})
      ON CREATE SET u.name = $userName, u.createdAt = $timestamp
      WITH u
      OPTIONAL MATCH (u)-[:LOGGED]->(m:Mood {date: $today})
      OPTIONAL MATCH (u)-[:SLEPT]->(sl:Sleep {date: $today})
      OPTIONAL MATCH (u)-[:EXERCISED]->(ex:Exercise {date: $today})
      OPTIONAL MATCH (u)-[:STUDIED]->(st:Study {date: $today})
      OPTIONAL MATCH (u)-[:WORKED]->(wk:Work {date: $today})
      OPTIONAL MATCH (u)-[:HAS_BURNOUT_RISK]->(br:BurnoutRisk {date: $today})
      OPTIONAL MATCH (u)-[:HAS_PRODUCTIVITY]->(prod:Productivity {date: $today})
      OPTIONAL MATCH (u)-[c:COMPLETED {date: $today}]->(h:Habit)
      OPTIONAL MATCH (u)-[iw:INTERACTED_WITH {date: $today}]->(p:Person)
      OPTIONAL MATCH (u)-[perf:PERFORMED {date: $today}]->(act:Activity)
      DETACH DELETE m, sl, ex, st, wk, br, prod, iw, perf
      WITH u
      OPTIONAL MATCH (p:Person) WHERE not (p)--() DELETE p
      WITH u
      OPTIONAL MATCH (act:Activity) WHERE not (act)--() DELETE act
      WITH u
      OPTIONAL MATCH (g:Goal) WHERE not (g)--() DELETE g
      `,
      { userId, today, userName, timestamp }
    );

    // 5. Run single transaction Cypher script to write all nodes & relationships
    const habitDefs = [
      { id: 'habit_sleep', name: 'Sleep 7+ hours', category: 'wellness', completed: !!habits.sleep },
      { id: 'habit_exercise', name: 'Exercise', category: 'fitness', completed: !!habits.exercise },
      { id: 'habit_meditation', name: 'Meditation', category: 'mindfulness', completed: !!habits.meditation },
      { id: 'habit_deepWork', name: 'Deep Work', category: 'productivity', completed: !!habits.deepWork },
    ];

    const cypher = `
      MERGE (u:User {id: $userId})
      ON CREATE SET u.name = $userName, u.createdAt = $timestamp

      // Create Mood and link
      CREATE (m:Mood {
        id: $moodId,
        score: $score,
        energyLevel: $energyLevel,
        stressLevel: $stressLevel,
        notes: $notes,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:LOGGED]->(m)

      // Create Sleep and link
      CREATE (sl:Sleep {
        id: $sleepId,
        hours: $sleepHours,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:SLEPT]->(sl)
      CREATE (m)-[:INFLUENCED_BY]->(sl)

      // Create Exercise and link
      CREATE (ex:Exercise {
        id: $exerciseId,
        duration: $exerciseDuration,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:EXERCISED]->(ex)

      // Create Study and link
      CREATE (st:Study {
        id: $studyId,
        hours: $studyHours,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:STUDIED]->(st)

      // Create Work and link
      CREATE (wk:Work {
        id: $workId,
        hours: $workHours,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:WORKED]->(wk)

      // Create BurnoutRisk and link
      CREATE (br:BurnoutRisk {
        id: $burnoutId,
        score: $burnoutScore,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:HAS_BURNOUT_RISK]->(br)
      CREATE (br)-[:BASED_ON]->(m)
      CREATE (br)-[:BASED_ON]->(sl)

      // Create Productivity and link
      CREATE (prod:Productivity {
        id: $prodId,
        score: $productivityScore,
        date: $today,
        timestamp: $timestamp
      })
      CREATE (u)-[:HAS_PRODUCTIVITY]->(prod)
      CREATE (prod)-[:INFLUENCED_BY]->(sl)

      // Habits merge and completed links
      WITH u, m, prod, sl
      UNWIND $habitDefs AS hDef
      MERGE (h:Habit { name: hDef.name, category: hDef.category })
        ON CREATE SET h.id = hDef.id
      CREATE (u)-[:COMPLETED { date: $today, completed: hDef.completed }]->(h)
      CREATE (m)-[:INFLUENCED_BY]->(h)
      
      // Conditionally link habits to productivity score
      WITH u, m, prod, hDef, h
      WHERE hDef.completed = true
      CREATE (prod)-[:INFLUENCED_BY]->(h)

      // Social person interaction logic (conditional via FOREACH)
      WITH u, m, prod
      FOREACH (_ IN CASE WHEN $personName IS NOT NULL AND $personName <> '' THEN [1] ELSE [] END |
        MERGE (p:Person { name: $personName })
        CREATE (u)-[:INTERACTED_WITH { date: $today }]->(p)
        CREATE (prod)-[:INFLUENCED_BY]->(p)
      )

      // Goal logic (conditional via FOREACH)
      WITH u, m, prod
      FOREACH (_ IN CASE WHEN $goalTitle IS NOT NULL AND $goalTitle <> '' THEN [1] ELSE [] END |
        MERGE (g:Goal { title: $goalTitle })
        CREATE (u)-[:PURSUING { date: $today }]->(g)
      )

      // Activity logic (conditional via FOREACH)
      WITH u, m, prod
      FOREACH (_ IN CASE WHEN $activityName IS NOT NULL AND $activityName <> '' THEN [1] ELSE [] END |
        MERGE (act:Activity { name: $activityName })
        CREATE (u)-[:PERFORMED { date: $today }]->(act)
        CREATE (m)-[:INFLUENCED_BY]->(act)
      )
    `;

    await runQuery(cypher, {
      userId,
      userName,
      moodId,
      sleepId,
      exerciseId,
      studyId,
      workId,
      burnoutId,
      prodId,
      score: numericMood,
      energyLevel,
      sleepHours: numericSleep,
      exerciseDuration: parseFloat(exerciseDuration),
      studyHours: parseFloat(studyHours),
      workHours: parseFloat(workHours),
      stressLevel,
      notes: notes || '',
      personName: socialInteraction || '',
      goalTitle: goalTitle || '',
      activityName: activityName || '',
      burnoutScore,
      productivityScore,
      today,
      timestamp,
      habitDefs,
    });

    res.json({
      success: true,
      entryId: moodId,
      date: today,
      burnoutScore,
      productivityScore
    });

  } catch (err) {
    console.error('Neo4j error in /mood/log:', err.message);
    res.json({
      success: true,
      entryId: moodId,
      offline: true,
      burnoutScore,
      productivityScore
    });
  }
});

module.exports = router;
