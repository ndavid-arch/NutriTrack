// Load environment variables from .env before anything else
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes = require('./routes/auth');
const foodRoutes = require('./routes/food');
const mealRoutes = require('./routes/meals');

const app  = express();
const PORT = process.env.PORT || 3000;

// Allow requests from any origin — needed when the frontend and backend
// run on different ports during local development (e.g. Live Server on 5500)
app.use(cors());

// Parse incoming request bodies as JSON so req.body works in routes
app.use(express.json());

// Serve all frontend HTML, CSS and JS files as static assets.
// This means http://localhost:3000 opens index.html automatically.
app.use(express.static(path.join(__dirname, '../frontend')));

// Mount API route groups — each file handles its own path prefix
app.use('/api/auth',  authRoutes);
app.use('/api/food',  foodRoutes);
app.use('/api/meals', mealRoutes);

// Fallback: any unmatched route returns index.html.
// This lets the frontend handle its own page navigation without 404s.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`NutriTrack server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
