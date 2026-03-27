# NutriTrack — Calorie Tracking & Meal Planning App

NutriTrack is a full-stack web application that helps users track their daily calorie intake, plan meals, and monitor their nutrition progress over time. It integrates the Edamam Food Database API to search for real nutritional data across thousands of foods, with support for dietary filters, weekly reports, and personalized calorie goals.

---

## Live Demo

- **Web01:** `http://<web01-ip>`
- **Web02:** `http://<web02-ip>`
- **Load Balancer:** `http://<lb01-ip>` ← main access point

---

## Features

- **User Authentication** — Signup and login with secure password rules and validated email domains
- **Food Search** — Search any food and get instant nutritional data (calories, protein, carbs, fat, fiber)
- **Dietary Filters** — Filter results by Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, and more
- **Meal Planner** — Log meals under Breakfast, Lunch, and Dinner for any date
- **Daily Calorie Goal** — Set a personal calorie target with a live progress bar
- **Weekly Reports** — 7-day calorie trend chart with your goal line, best day, and total logged
- **API Response Caching** — Food search results are cached locally to reduce API calls and improve speed
- **Error Handling** — Graceful messages for API failures, invalid inputs, and empty searches
- **Responsive Design** — Mobile-friendly with collapsible hamburger navigation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js + Express |
| API | Edamam Food Database API v2 |
| Charts | Chart.js |
| Process Manager | PM2 |
| Web Server | Nginx (reverse proxy) |
| Load Balancer | Nginx (upstream round-robin) |

---

## API Used

### Edamam Food Database API
- **Documentation:** https://developer.edamam.com/food-database-api-docs
- **Endpoint used:** `GET https://api.edamam.com/api/food-database/v2/parser`
- **What it provides:** Food name, calories, macronutrients (protein, carbs, fat, fiber), dietary labels
- **Why it was chosen:** Returns multiple matching foods per query (e.g. searching "milk" returns almond milk, oat milk, whole milk, etc.), supports dietary health filters, and has a generous free tier

All API calls are made **server-side** through the Express backend. API keys are never exposed to the browser.

---

## Project Structure

```
nutritrack/
├── frontend/
│   ├── index.html          # Login / Signup
│   ├── dashboard.html      # Home — calorie goal + today's meals
│   ├── search.html         # Food search with filters
│   ├── planner.html        # Meal planner by date
│   ├── reports.html        # Weekly calorie report + chart
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js          # Session helpers + fetch wrapper
│       └── nav.js          # Shared navigation, profile modal
├── backend/
│   ├── server.js           # Express entry point
│   ├── routes/
│   │   ├── auth.js         # Signup / login endpoints
│   │   ├── food.js         # Food search + Edamam proxy + cache
│   │   └── meals.js        # Meal log CRUD
│   └── data/
│       └── food_cache.json # Local cache for API responses
├── .env                    # API keys (not in repo)
├── .gitignore
├── package.json
└── README.md
```

---

## Local Setup

### Prerequisites

- Node.js v14 or higher
- npm
- An Edamam developer account with Food Database API access: https://developer.edamam.com

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/nutritrack.git
cd nutritrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root of the project:

```env
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key
PORT=3000
```

> API keys are provided separately in the assignment submission comment section as required.

### 4. Run the application

```bash
npm start
```

Open your browser at `http://localhost:3000`

---

## Deployment

Both **Web01** and **Web02** are configured identically. The **Load Balancer (Lb01)** distributes traffic between them using Nginx round-robin.

### Step 1 — Install Node.js on each web server

SSH into Web01 and Web02 and run:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # confirm installation
```

### Step 2 — Install PM2

```bash
sudo npm install -g pm2
```

PM2 keeps the Node.js server running after SSH sessions end and restarts it automatically if it crashes.

### Step 3 — Clone the repository on each server

```bash
cd /var/www
sudo git clone https://github.com/<your-username>/nutritrack.git
cd nutritrack
npm install
```

### Step 4 — Set up the environment file

```bash
sudo nano .env
```

Paste in:

```env
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key
PORT=3000
```

### Step 5 — Start the app with PM2

```bash
pm2 start backend/server.js --name nutritrack
pm2 startup     # makes PM2 auto-start on reboot
pm2 save
```

### Step 6 — Configure Nginx as a reverse proxy

```bash
sudo nano /etc/nginx/sites-available/nutritrack
```

Paste:

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/nutritrack /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Repeat **Steps 1–6** on Web02.

---

## Load Balancer Configuration

SSH into **Lb01** and configure Nginx to distribute traffic between Web01 and Web02:

```bash
sudo nano /etc/nginx/sites-available/nutritrack-lb
```

Paste:

```nginx
upstream nutritrack_backend {
    server <web01-ip>;
    server <web02-ip>;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://nutritrack_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/nutritrack-lb /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Verify load balancing

Send multiple requests and confirm both servers respond:

```bash
for i in {1..6}; do curl -s http://<lb01-ip> | grep -o "NutriTrack"; done
```

You can also verify from PM2 logs on each server:

```bash
pm2 logs nutritrack
```

Incoming requests should alternate between Web01 and Web02.

---

## Input Validation

All user inputs are validated with regex before any data is processed or stored.

| Field | Rule | Regex / Constraint |
|---|---|---|
| Username | Letters only, no digits or symbols | `/^[a-zA-Z]+$/` |
| Email | Only accepted domains, no uppercase | `/^[a-z0-9._%+\-]+@(gmail\.com\|alustudent\.com\|alustaff\.com)$/` |
| Password | Min 8 chars, must include uppercase, lowercase, digit, and special character | `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/` |
| Height | Numbers only, 50–272 cm | `/^\d+$/` + range check |
| Weight | Numbers only, 20–500 kg | `/^\d+$/` + range check |
| Daily Calorie Goal | Numbers only, 500–10000 kcal | `/^\d+$/` + range check |

**Rules enforced:**
- Letters cannot be entered in numeric fields (height, weight, calories)
- Numbers cannot be entered in the username field
- Fields cannot be left empty — all are required before submission
- Emails with capital letters are rejected
- Passwords shorter than 8 characters or missing any character class are rejected

---

## Error Handling

| Scenario | How it's handled |
|---|---|
| Food not found in API | Returns `404` with a user-friendly message |
| Edamam API is down | Returns `503` with "Service temporarily unavailable" |
| Invalid/missing API key | Returns `500` with "API configuration error" |
| Empty search input | Frontend blocks the request and shows inline validation |
| Invalid numeric inputs | Regex validation rejects letters, enforces min/max ranges |
| Session expired | Redirected to login page automatically |

---

## Bonus Features Implemented

- **User Authentication** — Signup, login, session management, account deletion
- **API Response Caching** — Results saved to `food_cache.json`; repeated searches never hit the API twice
- **Data Visualization** — Chart.js 7-day calorie trend with a dashed daily goal line
- **Advanced Input Validation** — Regex on all forms (password strength, email domain whitelist, numeric ranges)
- **Dietary Filter System** — 6 one-click health label filters (Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, Sugar-Free)

---

## Challenges

**1. API key exposure**
Initially, API calls were made from the frontend directly, exposing keys in the browser network tab. Fixed by routing all Edamam requests through the Express backend, which reads keys from a `.env` file that is gitignored.

**2. Single-result food search**
The Nutrition Analysis API only accepts specific ingredient strings like `"1 cup rice"` and returns one result. Switched to the Food Database Parse API which accepts plain food names and returns multiple matching results, making the search experience natural and useful.

**3. dotenv path resolution**
`require('dotenv').config()` defaults to looking in the current working directory. Since the server is inside `backend/` but `.env` is in the project root, the env file was silently not loading. Fixed with an explicit path: `require('dotenv').config({ path: path.join(__dirname, '../.env') })`.

**4. Timezone bug in meal planner**
`new Date().toISOString()` returns UTC time, causing the wrong date to appear for users in UTC+ timezones. Fixed with a local date helper function using `getFullYear()`, `getMonth()`, and `getDate()`.

---

## Credits & Attribution

- **Edamam Food Database API** — https://developer.edamam.com
  Food nutritional data, dietary labels, and search powered by Edamam
- **Chart.js** — https://www.chartjs.org
  Used for the 7-day calorie trend visualization
- **Express.js** — https://expressjs.com
- **Axios** — https://axios-http.com
- **dotenv** — https://github.com/motdotla/dotenv

---

## Security Notes

- API keys are stored in `.env` and listed in `.gitignore` — never committed to the repository
- All Edamam API calls are proxied through the backend
- Passwords are encoded before storage
- All user inputs are validated with regex before processing
- `.env` file contents are provided in the assignment submission comment section as instructed

---

## Author

Built as part of the ALU Software Engineering curriculum — Playing Around with APIs assignment.
