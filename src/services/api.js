import Constants from 'expo-constants';

// Central API service for MindGraph
// Switch BASE_URL to your Render.com URL when deployed
const getBaseUrl = () => {
  // For web platform
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    return `http://${hostname}:3000`;
  }

  // For native platforms in development (e.g. Expo Go)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3000`;
  }

  return 'http://localhost:3000';
};

const BASE_URL = getBaseUrl();

async function apiFetch(path, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  } catch (err) {
    console.warn(`API call failed (${path}):`, err.message);
    throw err;
  }
}

/**
 * Create a new user. Returns { userId, name, email }.
 */
export async function createUser(name, email) {
  return apiFetch('/api/users/create', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
}

/**
 * Log in a user by email address.
 * @param {string} email
 */
export async function loginUser(email) {
  return apiFetch('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Log a mood entry with habits.
 * @param {object} payload - { userId, score, energyLevel, notes, habits }
 */
export async function logMood(payload) {
  return apiFetch('/api/mood/log', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get insights data for a user (7-day mood, top habits, burnout score).
 * @param {string} userId
 */
export async function getInsights(userId) {
  return apiFetch(`/api/insights/${userId}`);
}

/**
 * Get AI-generated insight for a user.
 * @param {string} userId
 */
export async function getAiInsight(userId) {
  return apiFetch(`/api/ai-insight/${userId}`);
}

/**
 * Get node-link graph data for the interactive graph visualization.
 * @param {string} userId
 */
export async function getGraphData(userId) {
  return apiFetch(`/api/graph/data/${userId}`);
}

/**
 * Delete all user records from Neo4j DB.
 * @param {string} userId
 */
export async function resetUserData(userId) {
  return apiFetch(`/api/users/${userId}/reset`, {
    method: 'DELETE',
  });
}

export default { createUser, loginUser, logMood, getInsights, getAiInsight, getGraphData, resetUserData };
