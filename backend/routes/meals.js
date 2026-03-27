const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// Get all meals for a specific user and date
router.get('/:username/:date', async (req, res) => {
  const { username, date } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, meal_type, food_name, calories, protein, carbs, fat, fiber, serving, logged_at
       FROM meals
       WHERE username = $1 AND date = $2
       ORDER BY logged_at ASC`,
      [username, date]
    );

    // Group into breakfast / lunch / dinner
    const grouped = { breakfast: [], lunch: [], dinner: [], date, username };
    result.rows.forEach(row => {
      grouped[row.meal_type].push({
        id:       row.id,
        name:     row.food_name,
        calories: parseFloat(row.calories),
        protein:  parseFloat(row.protein),
        carbs:    parseFloat(row.carbs),
        fat:      parseFloat(row.fat),
        fiber:    parseFloat(row.fiber),
        serving:  row.serving,
        addedAt:  row.logged_at,
      });
    });

    res.json(grouped);

  } catch (err) {
    console.error('[MEALS] Get error:', err.message);
    res.status(500).json({ error: 'Could not load meals. Please try again.' });
  }
});

// Add food to a meal slot
router.post('/:username/:date/:slot', async (req, res) => {
  const { username, date, slot } = req.params;
  const { name, calories, protein, carbs, fat, fiber, serving } = req.body;

  if (!['breakfast', 'lunch', 'dinner'].includes(slot)) {
    return res.status(400).json({ error: 'Slot must be breakfast, lunch, or dinner.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Food name is required.' });
  }

  try {
    await pool.query(
      `INSERT INTO meals (username, date, meal_type, food_name, calories, protein, carbs, fat, fiber, serving)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [username, date, slot, name, calories || 0, protein || 0, carbs || 0, fat || 0, fiber || 0, serving || '']
    );

    // Return updated day meals
    const result = await pool.query(
      `SELECT id, meal_type, food_name, calories, protein, carbs, fat, fiber, serving, logged_at
       FROM meals WHERE username = $1 AND date = $2 ORDER BY logged_at ASC`,
      [username, date]
    );

    const grouped = { breakfast: [], lunch: [], dinner: [], date, username };
    result.rows.forEach(row => {
      grouped[row.meal_type].push({
        id:       row.id,
        name:     row.food_name,
        calories: parseFloat(row.calories),
        protein:  parseFloat(row.protein),
        carbs:    parseFloat(row.carbs),
        fat:      parseFloat(row.fat),
        fiber:    parseFloat(row.fiber),
        serving:  row.serving,
        addedAt:  row.logged_at,
      });
    });

    res.json({ message: 'Food added', meals: grouped });

  } catch (err) {
    console.error('[MEALS] Add error:', err.message);
    res.status(500).json({ error: 'Could not add food. Please try again.' });
  }
});

// Remove a meal entry by its row ID
router.delete('/:username/:date/:slot/:id', async (req, res) => {
  const { username, id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM meals WHERE id = $1 AND username = $2 RETURNING id`,
      [id, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meal entry not found.' });
    }

    res.json({ message: 'Food removed.' });

  } catch (err) {
    console.error('[MEALS] Delete error:', err.message);
    res.status(500).json({ error: 'Could not remove food. Please try again.' });
  }
});

// Weekly summary — last 7 days calorie totals
router.get('/:username/summary/week', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      `SELECT date::text, COALESCE(SUM(calories), 0)::float AS calories
       FROM meals
       WHERE username = $1
         AND date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY date
       ORDER BY date ASC`,
      [username]
    );

    // Fill in missing days with 0
    const summary = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const found = result.rows.find(r => r.date === dateStr);
      summary.push({ date: dateStr, calories: found ? found.calories : 0 });
    }

    res.json(summary);

  } catch (err) {
    console.error('[MEALS] Week summary error:', err.message);
    res.status(500).json({ error: 'Could not load weekly summary.' });
  }
});

module.exports = router;
