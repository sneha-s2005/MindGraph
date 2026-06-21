import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveEntry, clearAllEntries, MoodEntry } from './storage';
import { logMood, resetUserData } from '../services/api';

function getPastDateString(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 20 diverse sample entries (cycled for higher counts)
export const ALL_SAMPLE_ENTRIES: Omit<MoodEntry, 'id' | 'date'>[] = [
  {
    mood: 6, energy: 'Medium', sleepHours: 7.6, exerciseDuration: 0,
    studyHours: 1.0, workHours: 4.5, socialInteraction: 'Co-workers',
    stressLevel: 'Medium', goalTitle: 'Setup Project', activityName: 'Coding',
    habits: { sleep: true, exercise: false, meditation: false, deepWork: true },
    notes: 'Started the project. Good initial progress.',
  },
  {
    mood: 5, energy: 'Low', sleepHours: 5.8, exerciseDuration: 0,
    studyHours: 0.5, workHours: 6.0, socialInteraction: 'Roommate',
    stressLevel: 'High', goalTitle: 'API connection', activityName: 'Research',
    habits: { sleep: false, exercise: false, meditation: false, deepWork: false },
    notes: 'Struggling with database setup. Felt pretty tired today.',
  },
  {
    mood: 7, energy: 'Medium', sleepHours: 7.5, exerciseDuration: 20,
    studyHours: 1.5, workHours: 5.0, socialInteraction: 'Mentor Mark',
    stressLevel: 'Medium', goalTitle: 'Database Schema', activityName: 'Walking',
    habits: { sleep: true, exercise: true, meditation: false, deepWork: true },
    notes: 'Good session with Mentor Mark. Helped clarify the schema design.',
  },
  {
    mood: 6, energy: 'Medium', sleepHours: 7.8, exerciseDuration: 0,
    studyHours: 2.0, workHours: 5.5, socialInteraction: 'Design Team',
    stressLevel: 'Medium', goalTitle: 'UI Prototypes', activityName: 'Reading',
    habits: { sleep: true, exercise: false, meditation: true, deepWork: true },
    notes: 'Refining the visual styles. Decent focus blocks.',
  },
  {
    mood: 8, energy: 'High', sleepHours: 8.0, exerciseDuration: 30,
    studyHours: 2.0, workHours: 4.0, socialInteraction: 'Family',
    stressLevel: 'Low', goalTitle: 'Component library', activityName: 'Gym Workout',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Gym workout really boosted my energy today. Slept great!',
  },
  {
    mood: 9, energy: 'High', sleepHours: 8.2, exerciseDuration: 45,
    studyHours: 1.0, workHours: 5.0, socialInteraction: 'Friends',
    stressLevel: 'Low', goalTitle: 'State management', activityName: 'Cycling',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Went cycling. Clear head, great flow state in code.',
  },
  {
    mood: 7, energy: 'Medium', sleepHours: 7.5, exerciseDuration: 0,
    studyHours: 3.0, workHours: 6.0, socialInteraction: 'Study Group',
    stressLevel: 'Medium', goalTitle: 'Backend integration', activityName: 'Reading',
    habits: { sleep: true, exercise: false, meditation: false, deepWork: true },
    notes: 'Worked in a group study session. Productive but a bit noisy.',
  },
  {
    mood: 8, energy: 'High', sleepHours: 7.8, exerciseDuration: 30,
    studyHours: 1.5, workHours: 5.0, socialInteraction: 'Mentor Mark',
    stressLevel: 'Low', goalTitle: 'Interactive Graph', activityName: 'Gym Workout',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Implemented node drag force-directed simulation. Very satisfying!',
  },
  {
    mood: 7, energy: 'Medium', sleepHours: 7.0, exerciseDuration: 20,
    studyHours: 2.0, workHours: 5.5, socialInteraction: 'Co-workers',
    stressLevel: 'Medium', goalTitle: 'Insights screen', activityName: 'Walking',
    habits: { sleep: true, exercise: true, meditation: false, deepWork: true },
    notes: 'Walking during lunch helped clear developer fatigue.',
  },
  {
    mood: 8, energy: 'High', sleepHours: 8.0, exerciseDuration: 30,
    studyHours: 1.0, workHours: 4.5, socialInteraction: 'Mentor Mark',
    stressLevel: 'Low', goalTitle: 'Polish UI Details', activityName: 'Yoga',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Yoga in the morning made me feel very balanced.',
  },
  {
    mood: 4, energy: 'Low', sleepHours: 5.5, exerciseDuration: 0,
    studyHours: 0, workHours: 7.0, socialInteraction: 'Manager',
    stressLevel: 'High', goalTitle: 'Bug fixing', activityName: 'Debugging',
    habits: { sleep: false, exercise: false, meditation: false, deepWork: true },
    notes: 'Overloaded at work. Skipped exercise and sleep.',
  },
  {
    mood: 6, energy: 'Medium', sleepHours: 7.2, exerciseDuration: 15,
    studyHours: 1.5, workHours: 5.0, socialInteraction: 'Partner',
    stressLevel: 'Low', goalTitle: 'Code review', activityName: 'Light walk',
    habits: { sleep: true, exercise: true, meditation: false, deepWork: false },
    notes: 'Relaxed evening. Felt recovered.',
  },
  {
    mood: 9, energy: 'High', sleepHours: 8.5, exerciseDuration: 60,
    studyHours: 2.5, workHours: 4.0, socialInteraction: 'Friends',
    stressLevel: 'Low', goalTitle: 'Side project', activityName: 'Swimming',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Best day this week! Swimming gave me incredible energy.',
  },
  {
    mood: 5, energy: 'Low', sleepHours: 6.0, exerciseDuration: 0,
    studyHours: 1.0, workHours: 6.5, socialInteraction: 'Solo',
    stressLevel: 'High', goalTitle: 'Deadline crunch', activityName: 'Coffee sessions',
    habits: { sleep: false, exercise: false, meditation: false, deepWork: true },
    notes: 'Deadline pressure. Need to rest more.',
  },
  {
    mood: 7, energy: 'Medium', sleepHours: 7.3, exerciseDuration: 25,
    studyHours: 2.0, workHours: 5.0, socialInteraction: 'Family',
    stressLevel: 'Medium', goalTitle: 'Learning module', activityName: 'Jogging',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: false },
    notes: 'Morning jog set a positive tone for the day.',
  },
  {
    mood: 8, energy: 'High', sleepHours: 7.9, exerciseDuration: 35,
    studyHours: 1.0, workHours: 4.0, socialInteraction: 'Team lead',
    stressLevel: 'Low', goalTitle: 'Feature launch', activityName: 'Cycling',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Feature shipped! Celebrated with a bike ride.',
  },
  {
    mood: 6, energy: 'Medium', sleepHours: 7.0, exerciseDuration: 0,
    studyHours: 3.0, workHours: 5.5, socialInteraction: 'Classmates',
    stressLevel: 'Medium', goalTitle: 'Study plan', activityName: 'Group study',
    habits: { sleep: true, exercise: false, meditation: false, deepWork: true },
    notes: 'Collaborative study was engaging but tiring.',
  },
  {
    mood: 3, energy: 'Low', sleepHours: 5.0, exerciseDuration: 0,
    studyHours: 0, workHours: 8.0, socialInteraction: 'Solo',
    stressLevel: 'High', goalTitle: 'Fix production bug', activityName: 'Late night work',
    habits: { sleep: false, exercise: false, meditation: false, deepWork: false },
    notes: 'Exhausted. Production issue kept me up all night.',
  },
  {
    mood: 8, energy: 'High', sleepHours: 8.2, exerciseDuration: 40,
    studyHours: 1.5, workHours: 4.5, socialInteraction: 'Friends',
    stressLevel: 'Low', goalTitle: 'Wellness sprint', activityName: 'Hiking',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Hiking trip recharged my batteries completely.',
  },
  {
    mood: 7, energy: 'Medium', sleepHours: 7.4, exerciseDuration: 20,
    studyHours: 2.0, workHours: 5.0, socialInteraction: 'Mentor Mark',
    stressLevel: 'Low', goalTitle: 'Reflection & planning', activityName: 'Meditation walk',
    habits: { sleep: true, exercise: true, meditation: true, deepWork: true },
    notes: 'Great mentoring session. Clear direction for next sprint.',
  },
];

/**
 * Seeds `count` sample log entries into AsyncStorage and optionally syncs to Neo4j.
 * Returns the number of entries saved.
 */
export async function seedSampleLogs(count: number): Promise<number> {
  const [userId, userName] = await Promise.all([
    AsyncStorage.getItem('@mindgraph_userId'),
    AsyncStorage.getItem('@mindgraph_userName'),
  ]);

  const entries = Array.from({ length: count }, (_, i) => ({
    ...ALL_SAMPLE_ENTRIES[i % ALL_SAMPLE_ENTRIES.length],
    date: getPastDateString(count - 1 - i),
  }));

  for (const entry of entries) {
    await saveEntry(entry);
  }

  // Best-effort Neo4j sync
  if (userId && !userId.startsWith('local_')) {
    for (const entry of entries) {
      try {
        await logMood({
          userId,
          userName: userName || 'Friend',
          score: entry.mood,
          energyLevel: entry.energy,
          sleepHours: entry.sleepHours,
          exerciseDuration: entry.exerciseDuration,
          studyHours: entry.studyHours,
          workHours: entry.workHours,
          socialInteraction: entry.socialInteraction,
          stressLevel: entry.stressLevel,
          goalTitle: entry.goalTitle,
          activityName: entry.activityName,
          notes: entry.notes,
          habits: entry.habits,
          date: entry.date,
        });
      } catch {}
    }
  }

  return count;
}

/**
 * Clears all local entries and Neo4j graph data for the user.
 * Does NOT clear userId/userName/settings — account is preserved.
 */
export async function clearAllDemoData(): Promise<void> {
  const userId = await AsyncStorage.getItem('@mindgraph_userId');

  // Wipe Neo4j graph nodes (best-effort)
  if (userId && !userId.startsWith('local_')) {
    try {
      await resetUserData(userId);
    } catch {}
  }

  // Wipe local entries & badges only
  await Promise.all([
    clearAllEntries(),
    AsyncStorage.removeItem('@mindgraph_badge_unlocks'),
  ]);
}
