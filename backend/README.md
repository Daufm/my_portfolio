# 🛡️ Fuad Mohammed Umer — Portfolio Backend

Production-grade REST API powering the portfolio of **Fuad Mohammed Umer** — Information Security Professional & Full-Stack Engineer at Hijra Bank.

Built with **Node.js + Express + PostgreSQL**. Secured with JWT, bcrypt, Helmet, CORS, and rate limiting.

---

## 📁 Project Structure

```
portfolio-backend/
├── server.js                  # Express app entry point
├── package.json
├── .env.example               # Copy to .env and fill in values
├── .gitignore
│
├── db/
│   ├── connection.js          # pg Pool + query wrapper
│   ├── schema.sql             # All table definitions + triggers
│   ├── init.js                # Creates tables + seeds admin
│   └── seed.js                # Rich sample data for all tables
│
├── middleware/
│   ├── auth.js                # JWT protect middleware + signToken
│   └── validate.js            # express-validator error handler
│
└── routes/
    ├── auth.js                # Login, /me, change-password
    ├── blogs.js               # Blog CRUD + markdown + search
    ├── projects.js            # Projects CRUD
    ├── writeups.js            # CTF/Security writeups CRUD
    └── contact.js             # Contact form + email notification
```

---

## ⚡ Quick Start

### 1. Prerequisites
- Node.js ≥ 18
- PostgreSQL ≥ 14 running locally (or a hosted instance)

### 2. Install dependencies
```bash
cd portfolio-backend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your DB credentials, JWT secret, SMTP settings
```

### 4. Create the database
```bash
psql -U postgres -c "CREATE DATABASE portfolio_db;"
```

### 5. Initialize schema + seed data
```bash
npm run db:init     # Creates all tables, seeds admin account
npm run db:seed     # Loads sample blog posts, projects, writeups
```

### 6. Start the server
```bash
npm run dev         # Development (nodemon, auto-reload)
npm start           # Production
```

Server starts at `http://localhost:5000`

---

## 🔐 Authentication

All write operations (POST/PATCH/DELETE) require a **Bearer token**.

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fuad@hijrabank.et","password":"yourpassword"}'
```
Response:
```json
{ "success": true, "token": "eyJhbGci...", "admin": { "id": "...", "name": "Fuad Mohammed Umer" } }
```

**Use the token:**
```bash
curl http://localhost:5000/api/blogs/admin/all \
  -H "Authorization: Bearer eyJhbGci..."
```

---

## 📡 API Reference

### Health
| Method | Endpoint  | Auth | Description     |
|--------|-----------|------|-----------------|
| GET    | /health   | —    | Server status   |
| GET    | /api      | —    | API info        |

### Auth — `/api/auth`
| Method | Endpoint          | Auth  | Description              |
|--------|-------------------|-------|--------------------------|
| POST   | /login            | —     | Returns JWT token         |
| GET    | /me               | ✅    | Current admin info        |
| POST   | /change-password  | ✅    | Update admin password     |

### Blogs — `/api/blogs`
| Method | Endpoint          | Auth  | Description                      |
|--------|-------------------|-------|----------------------------------|
| GET    | /                 | —     | List published posts (paginated) |
| GET    | /:slug            | —     | Single post by slug               |
| GET    | /admin/all        | ✅    | All posts including drafts        |
| POST   | /                 | ✅    | Create new post (markdown)        |
| PATCH  | /:id              | ✅    | Update post fields                |
| DELETE | /:id              | ✅    | Delete post                       |

**Query params for GET /api/blogs:**
- `category` — `cybersecurity` | `webdev` | `ctf` | `tutorial`
- `tag` — filter by tag string
- `search` — full-text search title & excerpt
- `page`, `limit` — pagination

### Projects — `/api/projects`
| Method | Endpoint  | Auth  | Description               |
|--------|-----------|-------|---------------------------|
| GET    | /         | —     | List projects             |
| GET    | /:id      | —     | Single project            |
| POST   | /         | ✅    | Create project            |
| PATCH  | /:id      | ✅    | Update project            |
| DELETE | /:id      | ✅    | Delete project            |

**Query params:** `type` (`dev`|`sec`), `featured` (`true`)

### Writeups — `/api/writeups`
| Method | Endpoint  | Auth  | Description                  |
|--------|-----------|-------|------------------------------|
| GET    | /         | —     | List published writeups       |
| GET    | /:id      | —     | Single writeup (full content) |
| POST   | /         | ✅    | Create writeup                |
| PATCH  | /:id      | ✅    | Update writeup                |
| DELETE | /:id      | ✅    | Delete writeup                |

**Query params:** `platform`, `difficulty`, `tag`

### Contact — `/api/contact`
| Method | Endpoint  | Auth  | Description                     |
|--------|-----------|-------|---------------------------------|
| POST   | /         | —     | Submit contact message (5/hr)   |
| GET    | /         | ✅    | View all messages (admin)       |
| PATCH  | /:id      | ✅    | Update message status           |

---

## 🗄️ Database Schema

```
admins           → id, name, email, password, last_login
blog_posts       → id, title, slug, content(md), category, tags[], published, views
projects         → id, title, type, description, tech_stack[], security_notes, github_url
writeups         → id, title, platform, difficulty, content(md), tags[], steps[], tools_used[]
contact_messages → id, name, email, message, status, ip_address
page_views       → id, page, ref_type, ref_id, ip_hash (analytics)
```

---

## 🚀 Connecting the Frontend

In `portfolio.html`, update the API base URL at the top of the `<script>` section:

```javascript
const API_BASE = 'http://localhost:5000/api';  // development
// const API_BASE = 'https://api.fuadmohammed.dev/api';  // production
```

Then replace static data calls with fetch:
```javascript
// Example: load blog posts from API
const res  = await fetch(`${API_BASE}/blogs?category=cybersecurity`);
const data = await res.json();
// data.data → array of posts
```

---

## 🌍 Deployment

### Railway / Render / Fly.io
1. Push to GitHub
2. Connect repo to Railway/Render
3. Set all env vars from `.env.example`
4. Run `npm run db:init` as a one-time command
5. Start command: `npm start`

### Environment Variables to Set in Production
```
NODE_ENV=production
PORT=5000
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
JWT_SECRET          (use a long random string — openssl rand -hex 64)
ADMIN_EMAIL
ADMIN_PASSWORD
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_RECIPIENT
ALLOWED_ORIGINS     (your frontend domain)
```

---

## 🔒 Security Features

| Feature                  | Implementation                         |
|--------------------------|----------------------------------------|
| Password hashing         | bcrypt, cost factor 12                 |
| Authentication           | JWT (jsonwebtoken), 7-day expiry       |
| Security headers         | Helmet (11 HTTP headers)               |
| Rate limiting            | 100 req/15min global, 10/15min auth, 5/hr contact |
| CORS                     | Whitelist-only origins                 |
| Input validation         | express-validator on all POST routes   |
| SQL injection prevention | Parameterized queries via pg           |
| Request logging          | Morgan (combined format in production) |

---

*Built by Fuad Mohammed Umer — ICS2 Certified Cybersecurity Professional*
