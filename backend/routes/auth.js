const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, email, password, age, weight, height } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  try {
    // Encode password to Base64 before storing.
    // This is not full encryption, but ensures the raw password is never
    // stored in plain text in the database.
    const encoded = Buffer.from(password).toString('base64');

    // Parameterized query ($1, $2...) prevents SQL injection by separating
    // the query structure from the user-supplied values.
    const result = await pool.query(
      `INSERT INTO users (username, email, password, age, weight, height, goal)
       VALUES ($1, $2, $3, $4, $5, $6, 2000)
       RETURNING id, username, email, age, weight, height, goal, created_at`,
      [username, email, encoded, age || null, weight || null, height || null]
    );

    res.json({ message: 'Account created successfully', user: result.rows[0] });

  } catch (err) {
    // PostgreSQL error code 23505 = unique_violation.
    // We inspect the detail field to tell the user which field is duplicated.
    if (err.code === '23505') {
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

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Look up the user by username using a parameterized query
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found. Please sign up first.' });
    }

    const user = result.rows[0];

    // Encode the incoming password and compare against the stored encoded value
    const encoded = Buffer.from(password).toString('base64');
    if (user.password !== encoded) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Destructure to remove the password field before sending the user object
    // to the frontend — the password must never leave the server
    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful', user: safeUser });

  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/auth/update/:username
router.put('/update/:username', async (req, res) => {
  const { username } = req.params;
  const { weight, height, goal } = req.body;

  try {
    // COALESCE keeps the existing value if the incoming field is null,
    // so partial updates work without overwriting unchanged fields.
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

// DELETE /api/auth/delete/:username
router.delete('/delete/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // ON DELETE CASCADE in the meals table means all meal records for this
    // user are automatically deleted when the user row is removed.
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
