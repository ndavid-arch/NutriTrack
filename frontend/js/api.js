// Base path for all API calls — relative so it works on any host
// (localhost:3000 locally, the real domain when deployed)
const BASE = '/api';

// Generic fetch helper used by all API functions below.
// Handles two failure cases:
//   1. Network error (server unreachable) — fetch() itself throws
//   2. HTTP error (4xx/5xx) — server returned an error JSON body
async function apiFetch(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    // fetch() threw — server is completely unreachable
    throw new Error('Cannot reach the server. Please make sure the app is running.');
  }
  const data = await res.json();
  // Server responded but with an error status — throw so callers can catch it
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

const API = {
  // ── Auth ────────────────────────────────────────────────────────────────────

  // Create a new user account
  signup: (body) =>
    apiFetch(`${BASE}/auth/signup`, { method: 'POST', body: JSON.stringify(body) }),

  // Log in with username and password
  login: (body) =>
    apiFetch(`${BASE}/auth/login`, { method: 'POST', body: JSON.stringify(body) }),

  // Update height, weight or calorie goal for a logged-in user
  updateProfile: (username, body) =>
    apiFetch(`${BASE}/auth/update/${encodeURIComponent(username)}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Permanently delete a user account and all their meal data
  deleteAccount: (username) =>
    apiFetch(`${BASE}/auth/delete/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  // ── Meals ───────────────────────────────────────────────────────────────────

  // Get all meals for a user on a given date (format: YYYY-MM-DD)
  getMeals: (username, date) =>
    apiFetch(`${BASE}/meals/${encodeURIComponent(username)}/${date}`),

  // Add a food item to a meal slot (breakfast, lunch, or dinner)
  addMeal: (username, date, slot, food) =>
    apiFetch(`${BASE}/meals/${encodeURIComponent(username)}/${date}/${slot}`, { method: 'POST', body: JSON.stringify(food) }),

  // Remove a specific meal entry by its database row ID
  removeMeal: (username, date, slot, id) =>
    apiFetch(`${BASE}/meals/${encodeURIComponent(username)}/${date}/${slot}/${id}`, { method: 'DELETE' }),

  // Get calorie totals for each of the last 7 days (for the reports chart)
  getWeekSummary: (username) =>
    apiFetch(`${BASE}/meals/${encodeURIComponent(username)}/summary/week`),

  // ── Food Search ─────────────────────────────────────────────────────────────

  // Search for foods by name. Optional health filter (e.g. "vegan", "gluten-free")
  // narrows results to foods matching that dietary label.
  searchFood: (query, health = '') => {
    const url = `${BASE}/food/search?q=${encodeURIComponent(query)}${health ? `&health=${encodeURIComponent(health)}` : ''}`;
    return apiFetch(url);
  },
};

// Session — tracks who is currently logged in using localStorage.
// Only stores a lightweight user object (no password), not meal data.
// All persistent data lives in the PostgreSQL database.
const Session = {
  save:    (user) => localStorage.setItem('nutritrack_user', JSON.stringify(user)),
  get:     ()     => JSON.parse(localStorage.getItem('nutritrack_user')),
  clear:   ()     => localStorage.removeItem('nutritrack_user'),

  // Redirect to login page if no session exists.
  // Called at the top of every protected page to enforce authentication.
  require: ()     => {
    const user = Session.get();
    if (!user) { window.location.href = '/index.html'; return null; }
    return user;
  },
};
