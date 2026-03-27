const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const pool    = require('../db');

function normalize(str) {
  return str.toLowerCase().trim();
}

// Apply health label filter to a list of food objects
function applyHealthFilter(foods, health) {
  if (!health) return foods;
  const h = health.toUpperCase();
  return foods.filter(food =>
    Array.isArray(food.healthLabels) && food.healthLabels.includes(h)
  );
}

// Parse a single Edamam hint object into our standard food shape
function parseHint(hint) {
  const food = hint.food;
  const n    = food.nutrients || {};
  return {
    foodId:       food.foodId,
    name:         food.label,
    calories:     Math.round(n.ENERC_KCAL || 0),
    protein:      Math.round((n.PROCNT  || 0) * 10) / 10,
    carbs:        Math.round((n.CHOCDF  || 0) * 10) / 10,
    fat:          Math.round((n.FAT     || 0) * 10) / 10,
    fiber:        Math.round((n.FIBTG   || 0) * 10) / 10,
    serving:      'per 100g',
    healthLabels: food.healthLabels || [],
    category:     food.categoryLabel || 'food',
    source:       'api',
  };
}

// ── GET /api/food/search?q=juice&health=vegan ─────────────────────────────────
router.get('/search', async (req, res) => {
  const query  = req.query.q;
  const health = req.query.health || null;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  try {
    // ── Check PostgreSQL cache first ─────────────────────────────────────────
    const q = normalize(query);
    const cacheResult = await pool.query(
      `SELECT food_id AS "foodId", name, calories, protein, carbs, fat, fiber,
              serving, health_labels AS "healthLabels", category, source
       FROM food_cache
       WHERE LOWER(name) LIKE $1`,
      [`%${q}%`]
    );

    let cacheResults = cacheResult.rows;
    if (health) cacheResults = applyHealthFilter(cacheResults, health);

    if (cacheResults.length > 0) {
      console.log(`[CACHE HIT] "${query}" → ${cacheResults.length} result(s) from DB`);
      return res.json({ results: cacheResults, source: 'cache' });
    }

    // ── Call Edamam Food Database API ────────────────────────────────────────
    console.log(`[API CALL] Food DB Parse ← "${query}"${health ? ` [${health}]` : ''}`);

    const params = {
      app_id:  process.env.EDAMAM_FOOD_APP_ID  || process.env.EDAMAM_APP_ID,
      app_key: process.env.EDAMAM_FOOD_APP_KEY || process.env.EDAMAM_APP_KEY,
      ingr:    query,
    };
    if (health) params.health = health;

    const response = await axios.get(
      'https://api.edamam.com/api/food-database/v2/parser',
      { params, timeout: 8000 }
    );

    const hints = response.data.hints || [];

    if (hints.length === 0) {
      return res.status(404).json({
        error: `No foods found for "${query}". Try a different search term.`,
      });
    }

    const foods = hints.slice(0, 10).map(parseHint);

    // ── Save new foods to PostgreSQL cache ───────────────────────────────────
    for (const food of foods) {
      await pool.query(
        `INSERT INTO food_cache (food_id, name, calories, protein, carbs, fat, fiber, serving, health_labels, category, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (food_id) DO NOTHING`,
        [
          food.foodId, food.name, food.calories, food.protein,
          food.carbs, food.fat, food.fiber, food.serving,
          food.healthLabels, food.category, food.source,
        ]
      );
    }
    console.log(`[CACHED] ${foods.length} foods saved to DB for "${query}"`);

    return res.json({ results: foods, source: 'api' });

  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401) {
        console.error('[API ERROR] Invalid Edamam credentials');
        return res.status(500).json({ error: 'API configuration error. Please contact support.' });
      }
      if (status === 429) {
        console.error('[API ERROR] Edamam rate limit exceeded');
        return res.status(503).json({ error: 'Too many requests. Please wait a moment and try again.' });
      }
      if (status >= 500) {
        console.error(`[API ERROR] Edamam server error (${status})`);
        return res.status(503).json({ error: 'Food database is temporarily unavailable. Try again later.' });
      }
    }
    if (err.code === 'ECONNABORTED') {
      return res.status(503).json({ error: 'Request timed out. Please check your connection and try again.' });
    }
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'No internet connection. Showing cached results only.' });
    }

    console.error('[FOOD] Search error:', err.message);
    return res.status(503).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── GET /api/food/all — browse all cached foods in DB ────────────────────────
router.get('/all', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT food_id AS "foodId", name, calories, protein, carbs, fat, fiber,
              serving, health_labels AS "healthLabels", category, source
       FROM food_cache ORDER BY name ASC`
    );
    res.json({ foods: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[FOOD] All error:', err.message);
    res.status(500).json({ error: 'Could not load food list.' });
  }
});

module.exports = router;
