const express = require('express');
const OpenAI = require('openai');
const { runQuery } = require('../db/neo4j');

const router = express.Router();

let openaiClient;
function getOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// GET /api/ai-insight/:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  // 1. Fetch last 7 days of data from Neo4j
  let weeklyData = [];
  let topHabits = [];
  let burnoutScore = 0;

  try {
    const moodRecords = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[:LOGGED]->(m:Mood)
      WHERE m.date >= date() - duration({days: 7})
      RETURN m.score AS score, m.energyLevel AS energyLevel, m.date AS date
      ORDER BY m.date ASC
      `,
      { userId }
    );

    weeklyData = moodRecords.map((r) => ({
      score: parseFloat(r.score) || 5,
      energyLevel: r.energyLevel || 'Medium',
      date: r.date?.toString() || '',
    }));

    const habitRecords = await runQuery(
      `
      MERGE (u:User {id: $userId})
      WITH u
      MATCH (u)-[c:COMPLETED {completed: true}]->(h:Habit)
      MATCH (u)-[:LOGGED]->(m:Mood {date: c.date})
      WHERE m.date >= date() - duration({days: 7})
      WITH h.name AS habitName, avg(m.score) AS avgMood
      RETURN habitName, avgMood
      ORDER BY avgMood DESC
      LIMIT 3
      `,
      { userId }
    );

    topHabits = habitRecords.map((r) => r.habitName);

    // Calculate basic burnout score
    if (weeklyData.length > 0) {
      const avg = weeklyData.reduce((s, d) => s + d.score, 0) / weeklyData.length;
      if (avg < 5) burnoutScore += 30;
      const lowEnergyDays = weeklyData.filter((d) => d.energyLevel?.toLowerCase() === 'low').length;
      if (lowEnergyDays >= 3) burnoutScore += 20;
      burnoutScore = Math.min(burnoutScore, 100);
    }
  } catch (err) {
    console.error('Neo4j error fetching data for AI:', err.message);
    // Proceed with empty data — AI will give generic advice
  }

  // 1.5 Enforce AI Insight Policy if history is insufficient
  if (weeklyData.length < 3) {
    return res.json({
      dailyInsight: "Continue logging data for a few days to receive personalized AI insights.",
      weeklySummary: "Continue logging data for a few days to receive personalized AI insights.",
      behaviorExplanation: "Continue logging data for a few days to receive personalized AI insights.",
      forecastExplanation: "Continue logging data for a few days to receive personalized AI insights.",
      burnoutExplanation: "Continue logging data for a few days to receive personalized AI insights.",
      habitRecommendations: [],
      behaviorSuggestions: []
    });
  }

  // 2. Build prompt
  const scores = weeklyData.map((d) => d.score);
  const energyLevels = weeklyData.map((d) => d.energyLevel);
  const promptUser = `Here is my wellness data from the last 7 days:
- Daily mood scores (1-10): ${scores.length > 0 ? scores.join(', ') : '7, 8, 9'}
- Energy levels: ${energyLevels.length > 0 ? energyLevels.join(', ') : 'High, Medium'}
- Top habits that boosted mood: ${topHabits.length > 0 ? topHabits.join(', ') : 'Deep Work, Exercise'}
- Burnout risk score: ${burnoutScore}/100

Generate a JSON object with these exact keys:
1. dailyInsight: a short encouraging morning phrase (under 12 words)
2. weeklySummary: a summary of their mood and habits this week (under 20 words)
3. behaviorExplanation: how their habits affect their mood (under 20 words)
4. forecastExplanation: why their productivity forecast is what it is (under 20 words)
5. burnoutExplanation: details about their burnout contributors (under 20 words)
6. habitRecommendations: a JSON array of 2 short habit recommendations
7. behaviorSuggestions: a JSON array of 2 short daily routine suggestions
`;

  // Define rich static fallback data
  const fallbackData = {
    dailyInsight: 'Focus on small consistency wins today; your progress builds daily.',
    weeklySummary: 'Your mood has remained stable with positive deep work habits showing steady performance consistency.',
    behaviorExplanation: 'Consistent rest and deep work slots directly improve mood averages by reducing project backlog stress.',
    forecastExplanation: 'Tomorrow\'s productivity forecast is supported by your high study consistency and consistent workout logs.',
    burnoutExplanation: 'Current risk is under control. Ensure sleep levels do not drop below 7 hours to avoid focus fatigue.',
    habitRecommendations: [
      'Prioritize 30 minutes of aerobic exercise before starting your work block.',
      'Schedule a 10-minute mindfulness slot right after lunch to reset focus.'
    ],
    behaviorSuggestions: [
      'Place a glass of water next to your screen to maintain cognitive hydration.',
      'Close all browser tabs that are unrelated to your current goal before starting a task.'
    ]
  };

  // 3. Call OpenAI
  const openai = getOpenAI();
  if (!openai) {
    return res.json(fallbackData);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a personal wellness coach. You must respond ONLY with a valid raw JSON object matching the requested schema. Do not output markdown, wrappers, or backticks.',
        },
        { role: 'user', content: promptUser },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(content);
    res.json({
      dailyInsight: parsed.dailyInsight || fallbackData.dailyInsight,
      weeklySummary: parsed.weeklySummary || fallbackData.weeklySummary,
      behaviorExplanation: parsed.behaviorExplanation || fallbackData.behaviorExplanation,
      forecastExplanation: parsed.forecastExplanation || fallbackData.forecastExplanation,
      burnoutExplanation: parsed.burnoutExplanation || fallbackData.burnoutExplanation,
      habitRecommendations: parsed.habitRecommendations || fallbackData.habitRecommendations,
      behaviorSuggestions: parsed.behaviorSuggestions || fallbackData.behaviorSuggestions
    });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.json(fallbackData);
  }
});

module.exports = router;
