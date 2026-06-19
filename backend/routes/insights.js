const express = require('express');
const { runQuery } = require('../db/neo4j');

const router = express.Router();

// GET /api/insights/:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. Fetch 7-day Mood, Sleep, and Productivity entries
    const logs = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      OPTIONAL MATCH (u)-[:LOGGED]->(m:Mood)
      WHERE m.date >= date() - duration({days: 7})
      OPTIONAL MATCH (u)-[:SLEPT]->(sl:Sleep {date: m.date})
      OPTIONAL MATCH (u)-[:HAS_PRODUCTIVITY]->(p:Productivity {date: m.date})
      OPTIONAL MATCH (u)-[:HAS_BURNOUT_RISK]->(b:BurnoutRisk {date: m.date})
      RETURN m.date AS date, 
             m.score AS moodScore, 
             m.energyLevel AS energyLevel, 
             m.stressLevel AS stressLevel,
             sl.hours AS sleepHours,
             p.score AS productivityScore,
             b.score AS burnoutScore
      ORDER BY m.date ASC
      `,
      { userId }
    );

    // 2. Format weekly chart data
    const weeklyData = logs
      .filter(l => l.date)
      .map((r) => ({
        date: r.date.toString(),
        moodScore: parseFloat(r.moodScore) || 0,
        productivityScore: parseFloat(r.productivityScore) || 0,
        sleepHours: parseFloat(r.sleepHours) || 0,
        energyLevel: r.energyLevel || 'Medium',
        stressLevel: r.stressLevel || 'Medium',
        burnoutScore: parseFloat(r.burnoutScore) || 0,
      }));

    // Calculate Averages
    const moodAverage = weeklyData.length > 0 
      ? parseFloat((weeklyData.reduce((s, d) => s + d.moodScore, 0) / weeklyData.length).toFixed(1))
      : 0;

    const productivityAverage = weeklyData.length > 0
      ? Math.round(weeklyData.reduce((s, d) => s + d.productivityScore, 0) / weeklyData.length)
      : 0;

    // Calculate Averages and stats
    const sleepAverage = weeklyData.length > 0
      ? parseFloat((weeklyData.reduce((s, d) => s + d.sleepHours, 0) / weeklyData.length).toFixed(1))
      : 7.0;

    const stressScore = weeklyData.length > 0
      ? 100 - (weeklyData.reduce((s, d) => s + (d.stressLevel === 'High' ? 80 : d.stressLevel === 'Medium' ? 40 : 0), 0) / weeklyData.length)
      : 70;

    // Consistency Score: completed habits vs total possible in the last 7 days
    const consistencyRecords = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[c:COMPLETED]->(h:Habit)
      WHERE c.date >= date() - duration({days: 7})
      RETURN count(CASE WHEN c.completed = true THEN 1 END) AS completed, count(c) AS total
      `,
      { userId }
    );
    let consistencyScore = 0;
    if (consistencyRecords.length > 0 && consistencyRecords[0].total > 0) {
      consistencyScore = Math.round((consistencyRecords[0].completed / consistencyRecords[0].total) * 100);
    }

    // 2.2 Calculate Behavioral Intelligence Score (BIS) (0-100)
    const bis = Math.round(
      (moodAverage * 10) * 0.2 +
      (Math.min(sleepAverage / 8, 1) * 100) * 0.2 +
      consistencyScore * 0.2 +
      productivityAverage * 0.2 +
      stressScore * 0.2
    );
    const biScore = Math.max(0, Math.min(100, bis || 0));
    let biGrade = 'D';
    if (biScore >= 90) biGrade = 'A+';
    else if (biScore >= 80) biGrade = 'A';
    else if (biScore >= 70) biGrade = 'B';
    else if (biScore >= 60) biGrade = 'C';

    // 2.3 Tomorrow Productivity Forecast
    const last3 = weeklyData.slice(-3);
    const last3Mood = last3.length > 0 ? last3.reduce((s, d) => s + d.moodScore, 0) / last3.length : 7;
    const last3Sleep = last3.length > 0 ? last3.reduce((s, d) => s + d.sleepHours, 0) / last3.length : 7;

    const forecastFactors = [];
    let forecastScore = 70;

    if (last3Sleep >= 7) {
      forecastFactors.push('Good Sleep Trend');
      forecastScore += 8;
    }
    if (last3Mood >= 7) {
      forecastFactors.push('Positive Mood Pattern');
      forecastScore += 8;
    }
    
    forecastScore = Math.min(forecastScore, 100);
    const confidence = Math.min(98, 70 + (weeklyData.length * 4));
    const forecastReasoning = `Tomorrow's forecast is ${forecastScore}/100 based on your ${forecastFactors.length > 0 ? forecastFactors.join(', ').toLowerCase() : 'recent behaviors'}.`;

    // 3. Advanced Burnout Calculation
    let burnoutScore = 0;
    if (weeklyData.length > 0) {
      const lastEntry = weeklyData[weeklyData.length - 1];
      burnoutScore = lastEntry.burnoutScore || 0;
    }

    // Trend calculation
    let burnoutTrend = 'stable';
    if (weeklyData.length >= 4) {
      const half = Math.floor(weeklyData.length / 2);
      const firstHalf = weeklyData.slice(0, half).reduce((s, d) => s + d.moodScore, 0) / half;
      const secondHalf = weeklyData.slice(half).reduce((s, d) => s + d.moodScore, 0) / (weeklyData.length - half);
      if (secondHalf > firstHalf + 0.5) burnoutTrend = 'improving';
      if (secondHalf < firstHalf - 0.5) burnoutTrend = 'worsening';
    }

    // 3.2 Burnout Contributors Explanation
    const burnoutContributors = [];
    if (sleepAverage < 6.8) burnoutContributors.push('Low Sleep Consistency');
    if (stressScore < 60) burnoutContributors.push('High Stress Trend');
    if (consistencyScore < 60) burnoutContributors.push('Reduced Exercise/Habit Frequency');
    if (moodAverage < 6) burnoutContributors.push('Negative Mood Pattern');
    if (burnoutContributors.length === 0) burnoutContributors.push('Stable Balance');

    // 4. Positive Habit Correlations (Habits completed on high mood days >= 7)
    const positiveHabits = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[c:COMPLETED {completed: true}]->(h:Habit)
      MATCH (u)-[:LOGGED]->(m:Mood {date: c.date})
      WHERE m.score >= 7
      RETURN h.name AS habitName, count(c) AS completions
      ORDER BY completions DESC
      LIMIT 3
      `,
      { userId }
    );

    // 4.2 Most Influential Habit Card Logic
    let mostInfluentialHabitName = null;
    let habitImpactPct = 0;
    let habitTrendText = 'stable';
    let habitReasoning = null;

    if (positiveHabits.length > 0) {
      mostInfluentialHabitName = positiveHabits[0].habitName;
      habitImpactPct = 25 + Math.round((positiveHabits[0].completions / (weeklyData.length || 1)) * 20);
      habitReasoning = `Completing ${mostInfluentialHabitName} regularly leads to a measurable increase in your daily performance score.`;
    }

    // 5. Negative Habit Correlations (Habits associated with low mood < 5 or stress)
    const negativeHabits = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[c:COMPLETED {completed: true}]->(h:Habit)
      MATCH (u)-[:LOGGED]->(m:Mood {date: c.date})
      WHERE m.score < 5 OR m.stressLevel = 'High'
      RETURN h.name AS habitName, count(c) AS completions
      ORDER BY completions DESC
      LIMIT 3
      `,
      { userId }
    );

    // 5.2 Most Influential Activity Logic — only from real Neo4j data
    let mostInfluentialActivityName = null;
    let activityImpactScore = 0;
    let activityStrength = 'None';
    let activityIsPositive = true;

    const activityQuery = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[p:PERFORMED]->(act:Activity)
      MATCH (u)-[:LOGGED]->(m:Mood {date: p.date})
      RETURN act.name AS name, avg(m.score) AS avgMood
      ORDER BY avgMood DESC
      LIMIT 1
      `,
      { userId }
    );
    if (activityQuery.length > 0 && activityQuery[0].name) {
      mostInfluentialActivityName = activityQuery[0].name;
      activityImpactScore = Math.round(activityQuery[0].avgMood * 10);
      activityStrength = activityImpactScore >= 80 ? 'Strong' : activityImpactScore >= 50 ? 'Moderate' : 'Weak';
    }


    // 7. Sleep Impact Analysis: average mood and productivity when sleep >= 7 vs < 7
    const sleepImpactRecords = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[:SLEPT]->(sl:Sleep)
      OPTIONAL MATCH (u)-[:LOGGED]->(m:Mood {date: sl.date})
      OPTIONAL MATCH (u)-[:HAS_PRODUCTIVITY]->(p:Productivity {date: sl.date})
      WITH sl.hours >= 7 AS goodSleep, m.score AS mood, p.score AS prod
      WHERE mood IS NOT NULL
      RETURN goodSleep, avg(mood) AS avgMood, avg(prod) AS avgProd
      `,
      { userId }
    );

    let sleepImpact = {
      goodSleepMood: 0,
      goodSleepProd: 0,
      badSleepMood: 0,
      badSleepProd: 0
    };

    sleepImpactRecords.forEach((r) => {
      if (r.goodSleep) {
        sleepImpact.goodSleepMood = parseFloat(r.avgMood?.toFixed(1)) || 0;
        sleepImpact.goodSleepProd = Math.round(r.avgProd) || 0;
      } else {
        sleepImpact.badSleepMood = parseFloat(r.avgMood?.toFixed(1)) || 0;
        sleepImpact.badSleepProd = Math.round(r.avgProd) || 0;
      }
    });

    // 8. Positive & Negative Paths
    const isInsufficient = weeklyData.length < 3;

    // 8. Positive & Negative Paths
    const strongestPositive = isInsufficient ? {
      path: "Not enough historical data available yet.",
      score: 0
    } : {
      path: `${mostInfluentialHabitName} ➔ Mood ➔ Productivity`,
      score: Math.round(biScore * 0.9)
    };
    const strongestNegative = isInsufficient ? {
      path: "Not enough historical data available yet.",
      score: 0
    } : {
      path: `Stress ➔ Sleep Deprivation ➔ Burnout`,
      score: Math.round(burnoutScore)
    };
    const relationshipStrengthScore = isInsufficient ? 0 : Math.round((consistencyScore + biScore) / 2);

    res.json({
      moodAverage,
      productivityAverage,
      burnoutScore,
      burnoutTrend,
      weeklyData,
      consistencyScore,
      sleepImpact,
      topHabits: isInsufficient ? [] : positiveHabits.map((h) => ({ 
        name: h.habitName, 
        correlationPct: 25 + Math.round((h.completions / (weeklyData.length || 1)) * 20)
      })),
      negativeHabits: isInsufficient ? [] : negativeHabits.map((h, i) => ({ name: h.habitName, frequency: h.completions })),
      
      // Added Intelligence properties
      behavioralIntelligence: {
        score: isInsufficient ? 0 : biScore,
        grade: isInsufficient ? '—' : biGrade,
        sleepScore: isInsufficient ? 0 : Math.round(Math.min(sleepAverage / 8, 1) * 100),
        moodScore: isInsufficient ? 0 : moodAverage * 10,
        stressScore: isInsufficient ? 0 : stressScore,
        habitScore: isInsufficient ? 0 : consistencyScore,
        productivityScore: isInsufficient ? 0 : productivityAverage
      },
      productivityForecast: {
        score: isInsufficient ? 0 : forecastScore,
        confidence: isInsufficient ? 0 : confidence,
        factors: isInsufficient ? [] : forecastFactors,
        reasoning: isInsufficient ? "More data is required before predictions can be generated." : forecastReasoning
      },
      mostInfluentialHabit: {
        name: isInsufficient || !mostInfluentialHabitName ? "Not enough historical data available yet." : mostInfluentialHabitName,
        impactPct: isInsufficient ? 0 : habitImpactPct,
        trend: isInsufficient ? "stable" : habitTrendText,
        reasoning: isInsufficient || !habitReasoning ? "Not enough historical data available yet." : habitReasoning
      },
      mostInfluentialActivity: {
        name: isInsufficient || !mostInfluentialActivityName ? "Not enough historical data available yet." : mostInfluentialActivityName,
        impactScore: isInsufficient ? 0 : activityImpactScore,
        strength: isInsufficient || !mostInfluentialActivityName ? "None" : activityStrength,
        isPositive: isInsufficient ? true : activityIsPositive
      },
      burnoutExplanation: {
        score: burnoutScore,
        contributors: isInsufficient ? ["Not enough historical data available yet."] : burnoutContributors
      },
      relationships: {
        strongestPositive,
        strongestNegative,
        relationshipStrengthScore
      }
    });

  } catch (err) {
    console.error('Neo4j error in /insights:', err.message);
    res.json({
      moodAverage: 0,
      productivityAverage: 0,
      burnoutScore: 0,
      burnoutTrend: 'stable',
      weeklyData: [],
      consistencyScore: 0,
      sleepImpact: { goodSleepMood: 0, goodSleepProd: 0, badSleepMood: 0, badSleepProd: 0 },
      topHabits: [],
      negativeHabits: [],
      behavioralIntelligence: {
        score: 0,
        grade: '—',
        sleepScore: 0,
        moodScore: 0,
        stressScore: 0,
        habitScore: 0,
        productivityScore: 0
      },
      productivityForecast: {
        score: 0,
        confidence: 0,
        factors: [],
        reasoning: "More data is required before predictions can be generated."
      },
      mostInfluentialHabit: {
        name: "Not enough historical data available yet.",
        impactPct: 0,
        trend: "stable",
        reasoning: "Not enough historical data available yet."
      },
      mostInfluentialActivity: {
        name: "Not enough historical data available yet.",
        impactScore: 0,
        strength: "None",
        isPositive: true
      },
      burnoutExplanation: {
        score: 0,
        contributors: ["Not enough historical data available yet."]
      },
      relationships: {
        strongestPositive: { path: "Not enough historical data available yet.", score: 0 },
        strongestNegative: { path: "Not enough historical data available yet.", score: 0 },
        relationshipStrengthScore: 0
      },
      offline: true,
      error: err.message
    });
  }
});

module.exports = router;
