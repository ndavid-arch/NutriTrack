# NutriTrack 
# Calorie Tracking & Meal Planning App

NutriTrack is a full-stack web application that helps users track their daily calorie intake, plan meals, and monitor their nutrition progress over time. It integrates the Edamam Food Database API to search for real nutritional data across thousands of foods, with support for dietary filters, weekly reports, and personalized calorie goals.

---

## Live Demo
Demo Vidoe: (https://www.loom.com/share/75f9d23fac9648ff9fe594aa00bc1381)

## TRY IT

- **Load Balancer:** `https://nutritrack.sftracker.tech` ← main access point (HTTPS)

> HTTP requests are automatically redirected to HTTPS.

---

## Features

- **User Authentication** — Signup and login with secure password rules and validated email domains
- **Food Search** — Search any food and get instant nutritional data (calories, protein, carbs, fat, fiber)
- **Dietary Filters** — Filter results by Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, and more
- **Meal Planner** — Log meals under Breakfast, Lunch, and Dinner for any date
- **Daily Calorie Goal** — Set a personal calorie target with a live progress bar
- **Weekly Reports** — 7-day calorie trend chart with your goal line, best day, and total logged
- **API Response Caching** — Food search results are cached in PostgreSQL to reduce API calls and improve speed
- **Error Handling** — Graceful messages for API failures, invalid inputs, and empty searches
- **Responsive Design** — Mobile-friendly with collapsible hamburger navigation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js + Express |
| Database | PostgreSQL (Aiven Cloud) |
| API | Edamam Food Database API v2 |
| Charts | Chart.js |
| Process Manager | PM2 |
| Web Server | Nginx (reverse proxy) |
| Load Balancer | Nginx (upstream round-robin) |
| SSL Certificate | Let's Encrypt (Certbot) |
| CI/CD | GitHub Actions |

---

## API Used

### Edamam Food Database API
- **Documentation:** https://developer.edamam.com/food-database-api-docs
- **Endpoint used:** `GET https://api.edamam.com/api/food-database/v2/parser`
- **What it provides:** Food name, calories, macronutrients (protein, carbs, fat, fiber), dietary labels
- **Why it was chosen:** Returns multiple matching foods per query (e.g. searching "milk" returns almond milk, oat milk, whole milk, etc.), supports dietary health filters, and has a generous free tier

All API calls are made **server-side** through the Express backend. API keys are never exposed to the browser.

## Project Structure

```
nutritrack/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions CI/CD pipeline
├── frontend/
│   ├── index.html          # Login / Signup
│   ├── dashboard.html      # Home — calorie goal + today's meals
│   ├── search.html         # Food search with filters
│   ├── planner.html        # Meal planner by date
│   ├── reports.html        # Weekly calorie report + chart
│   ├── css/
│   │   └── style.css       # Global stylesheet
│   └── js/
│       ├── api.js          # Session helpers + fetch wrapper
│       └── nav.js          # Shared navigation, profile modal
├── backend/
│   ├── server.js           # Express entry point
│   ├── db.js               # PostgreSQL connection (Aiven)
│   ├── migrate.js          # Database table creation script
│   └── routes/
│       ├── auth.js         # Signup / login / update / delete endpoints
│       ├── food.js         # Food search + Edamam proxy + DB cache
│       └── meals.js        # Meal log CRUD endpoints
├── .env.example            # Environment variable template
├── .gitignore
├── package-lock.json
├── package.json
└── README.md
```

## Local Setup

### Prerequisites

- Node.js v18 or higher
- npm
- PostgreSQL database (Aiven Cloud or local)
- An Edamam developer account with Food Database API access: https://developer.edamam.com

### 1. Clone the repository

```bash
git clone https://github.com/ndavid-arch/NutriTrack.git
cd NutriTrack
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
mv .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
DATABASE_URL=your_postgresql_connection_string
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key
```

> API keys and database credentials are provided separately in the assignment submission comment section as required.

### 4. Run the database migration

```bash
node backend/migrate.js
```

This creates the `users`, `meals`, and `food_cache` tables in your PostgreSQL database.

### 5. Run the application

```bash
npm start
```

Open your browser at `http://localhost:3000`

---

## Deployment

Both **Web01** and **Web02** are configured identically. The **Load Balancer (Lb01)** distributes traffic between them using Nginx round-robin. All traffic is served over HTTPS via a Let's Encrypt SSL certificate.

### Step 1 — Install Node.js and Git on each web server

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v
```

### Step 2 — Install PM2

```bash
sudo npm install -g pm2
```

### Step 3 — Clone the repository

```bash
cd /var/www
sudo git clone https://github.com/ndavid-arch/NutriTrack.git
sudo chown -R ubuntu:ubuntu /var/www/NutriTrack
cd NutriTrack
npm install
```

### Step 4 — Set up the environment file

```bash
mv /var/www/NutriTrack/.env.example /var/www/NutriTrack/.env
nano /var/www/NutriTrack/.env
```

### Step 5 — Run the database migration

Only needs to run once on Web01 — both servers share the same Aiven database:

```bash
node /var/www/NutriTrack/backend/migrate.js
```

### Step 6 — Start the app with PM2

```bash
cd /var/www/NutriTrack
pm2 start backend/server.js --name nutritrack
pm2 startup   # copy and run the command it outputs
pm2 save
```

### Step 7 — Configure Nginx as a reverse proxy

```bash
sudo nano /etc/nginx/sites-available/nutritrack
```

Paste:

```nginx
server {
    listen 80;
    server_name _;

    root /var/www/NutriTrack/frontend;
    index index.html;

    add_header X-Served-By "Web01";   # use "Web02" on the second server

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/nutritrack /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Repeat Steps 1–7 on Web02 (change `X-Served-By` to `"Web02"`).

---

## Load Balancer Configuration

SSH into Lb01 and configure Nginx:

```bash
sudo nano /etc/nginx/sites-available/nutritrack-lb
```

Paste:

```nginx
upstream nutritrack_backend {
    server 18.208.109.195:80 max_fails=1 fail_timeout=30s;
    server 35.175.137.170:80 max_fails=2 fail_timeout=10s;
}

server {
    listen 80;
    server_name nutritrack.sftracker.tech;

    location / {
        proxy_pass http://nutritrack_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_pass_header X-Served-By;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/nutritrack-lb /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Verify load balancing

```bash
for i in {1..6}; do curl -sI https://nutritrack.sftracker.tech | grep X-Served-By; done
```

---

## SSL Certificate (HTTPS)

HTTPS is configured on the load balancer using a free Let's Encrypt certificate via Certbot.

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Obtain and install the certificate

```bash
sudo certbot --nginx -d nutritrack.sftracker.tech
```

When prompted, select option **2 (Redirect)** to automatically redirect all HTTP traffic to HTTPS.

### Auto-renewal test

```bash
sudo certbot renew --dry-run
```

> Certificate expires 2026-06-27 and renews automatically.

---

## CI/CD Pipeline

Every push to the `main` branch automatically deploys to both Web01 and Web02 using GitHub Actions.

### How it works

```
Push to main → GitHub Actions → SSH into Web01 & Web02 → git pull → npm install → pm2 restart
```

### Setup

Add the following secrets to your GitHub repo under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `SSH_PRIVATE_KEY` | Contents of your `~/.ssh/id_rsa` private key |
| `WEB01_IP` | `18.208.109.195` |
| `WEB02_IP` | `35.175.137.170` |
| `SSH_USER` | `ubuntu` |

The workflow file is already included at `.github/workflows/deploy.yml`. Push any change to `main` and go to the **Actions** tab on GitHub to watch it run.

---

## Input Validation

| Field | Rule | Regex / Constraint |
|---|---|---|
| Username | Letters only, no digits or symbols | `/^[a-zA-Z]+$/` |
| Email | Only accepted domains, no uppercase | `/^[a-z0-9._%+\-]+@(gmail\.com\|alustudent\.com\|alustaff\.com)$/` |
| Password | Min 8 chars, must include uppercase, lowercase, digit, and special character | `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/` |
| Height | Numbers only, 50–272 cm | `/^\d+$/` + range check |
| Weight | Numbers only, 20–500 kg | `/^\d+$/` + range check |
| Daily Calorie Goal | Numbers only, 500–10000 kcal | `/^\d+$/` + range check |

---

## Error Handling

| Scenario | How it's handled |
|---|---|
| Food not found in API | Returns `404` with a user-friendly message |
| Edamam API is down | Returns `503` with "Service temporarily unavailable" |
| Invalid/missing API key | Returns `500` with "API configuration error" |
| Request timeout | Returns `504` with "Request timed out" |
| Empty search input | Frontend blocks the request and shows inline validation |
| Invalid numeric inputs | Regex validation rejects letters, enforces min/max ranges |
| Session expired | Redirected to login page automatically |
| Database unreachable | Returns `500` with a graceful error message |

---

## Bonus Features Implemented

- **User Authentication** — Signup, login, session management, account deletion
- **PostgreSQL Caching** — Food search results cached in Aiven PostgreSQL; repeated searches never hit the API twice
- **Data Visualization** — Chart.js 7-day calorie trend with a dashed daily goal line
- **Advanced Input Validation** — Regex on all forms (password strength, email domain whitelist, numeric ranges)
- **Dietary Filter System** — 6 one-click health label filters (Vegan, Gluten-Free, Dairy-Free, Keto, Paleo, Sugar-Free)
- **HTTPS & SSL** — Let's Encrypt certificate with automatic HTTP → HTTPS redirect
- **CI/CD Pipeline** — GitHub Actions auto-deploys on every push to main

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

**5. File permission errors on server**
Using `sudo git clone` made all files owned by root, preventing direct file creation with `nano`. Fixed by using `chown` to transfer ownership to the ubuntu user.

**6. HAProxy conflict on load balancer**
The school-provisioned Lb01 had HAProxy pre-installed and occupying port 80, preventing Nginx from starting. Fixed by stopping and disabling HAProxy with `sudo systemctl stop haproxy && sudo systemctl disable haproxy`.

**7. Web01 slow response via public IP**
AWS hairpin NAT caused Web01 to take 130 seconds when connecting to its own public IP. Fixed by configuring `max_fails=1 fail_timeout=30s` on the load balancer so failed requests to Web01 immediately fall back to Web02.

---

## Credits & Attribution

- **Edamam Food Database API** — https://developer.edamam.com
- **Chart.js** — https://www.chartjs.org
- **Aiven PostgreSQL** — https://aiven.io
- **Express.js** — https://expressjs.com
- **Axios** — https://axios-http.com
- **dotenv** — https://github.com/motdotla/dotenv
- **PM2** — https://pm2.keymatrics.io
- **Let's Encrypt / Certbot** — https://letsencrypt.org
- **GitHub Actions** — https://github.com/features/actions

---

## Security Notes

- API keys are stored in `.env` and listed in `.gitignore` — never committed to the repository
- All Edamam API calls are proxied through the backend — keys never reach the browser
- Passwords are encoded before storage
- All user inputs are validated with regex before processing
- SQL queries use parameterized statements to prevent SQL injection
- HTTPS enforced via Let's Encrypt SSL certificate with automatic HTTP redirect
- `.env` file contents are provided in the assignment submission comment section as instructed

---

## Author

NTWALI Beni David
```
