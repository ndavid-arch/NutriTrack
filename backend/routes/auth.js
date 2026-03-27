const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// Signup
router.post('/signup', async (req, res) => {
  const { username, email, password, age, weight, height } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  try {
    const encoded = Buffer.from(password).toString('base64');

    const result = await pool.query(
      `INSERT INTO users (username, email, password, age, weight, height, goal)
       VALUES ($1, $2, $3, $4, $5, $6, 2000)
       RETURNING id, username, email, age, weight, height, goal, created_at`,
      [username, email, encoded, age || null, weight || null, height || null]
    );

    res.json({ message: 'Account created successfully', user: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      // Unique constraint violation
      if (err.detail.includes('username')) {
        return res.status(409).json({ error: 'Username already taken. Please choose another.' });
      }
      if (err.detail.includes('email')) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
    }
    console.error('[AUTH] Signup error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found. Please sign up first.' });
    }

    const user = result.rows[0];
    const encoded = Buffer.from(password).toString('base64');

    if (user.password !== encoded) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful', user: safeUser });

  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Update profile (height, weight, goal)
router.put('/update/:username', async (req, res) => {
  const { username } = req.params;
  const { weight, height, goal } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET weight = COALESCE($1, weight),
           height = COALESCE($2, height),
           goal   = COALESCE($3, goal)
       WHERE username = $4
       RETURNING id, username, email, age, weight, height, goal, created_at`,
      [weight || null, height || null, goal || null, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ message: 'Profile updated', user: result.rows[0] });

  } catch (err) {
    console.error('[AUTH] Update error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Delete account
router.delete('/delete/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM users WHERE username = $1 RETURNING username`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ message: 'Account deleted successfully.' });

  } catch (err) {
    console.error('[AUTH] Delete error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
