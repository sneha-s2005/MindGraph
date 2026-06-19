import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HabitList {
  sleep: boolean;      // Sleep 7hrs
  exercise: boolean;   // Exercise
  meditation: boolean; // Meditation
  deepWork: boolean;   // Deep Work
}

export interface MoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: number; // 1-10
  energy: 'Low' | 'Medium' | 'High';
  sleepHours: number;
  exerciseDuration: number;
  studyHours: number;
  workHours: number;
  socialInteraction: string;
  stressLevel: 'Low' | 'Medium' | 'High';
  goalTitle: string;
  activityName: string;
  habits: HabitList;
  notes: string;
}

const STORAGE_KEY = '@mindgraph_entries_v2'; // Bump version key

// Formats a Date object to YYYY-MM-DD local time string
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getEntries(): Promise<MoodEntry[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as MoodEntry[];
      // Sort entries by date ascending
      return parsed.sort((a, b) => a.date.localeCompare(b.date));
    }
    // No data yet — return empty array (no seeding/mocking)
    return [];
  } catch (error) {
    console.error('Failed to get mood entries:', error);
    return [];
  }
}

export async function saveEntry(entry: Omit<MoodEntry, 'id'>): Promise<MoodEntry> {
  try {
    const entries = await getEntries();
    
    // Check if an entry for this date already exists. If so, overwrite it.
    const existingIndex = entries.findIndex(e => e.date === entry.date);
    
    const newEntry: MoodEntry = {
      ...entry,
      id: existingIndex >= 0 ? entries[existingIndex].id : Math.random().toString(36).substring(2, 9),
    };

    if (existingIndex >= 0) {
      entries[existingIndex] = newEntry;
    } else {
      entries.push(newEntry);
    }

    // Sort by date ascending before saving
    entries.sort((a, b) => a.date.localeCompare(b.date));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return newEntry;
  } catch (error) {
    console.error('Failed to save mood entry:', error);
    throw error;
  }
}

export async function clearAllEntries(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear mood entries:', error);
  }
}
