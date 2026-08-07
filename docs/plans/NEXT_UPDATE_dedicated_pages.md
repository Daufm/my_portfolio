# Next Update — Dedicated Research & Blog Pages

> **Goal:** Stop opening writeups/posts in a modal on `index.html`.  
> Instead, navigate to clean URLs like:
>
> - Research / CTF → `https://fuadportfolio.vercel.app/research/<slug-or-id>`
> - Security Writings → `https://fuadportfolio.vercel.app/blog/<slug>`
>
> This is a **multi-layer change**. Do it in order. Do not start with frontend-only hacks.

---

## Why so many files change

| Layer | Today | Target |
|-------|--------|--------|
| DB | Writeups have `id` (UUID) only — **no slug** | Writeups get a unique `slug` (like blogs already have) |
| Admin form | Creates writeup → returns UUID | Creates writeup → generates slug from title |
| API | `GET /api/writeups/:id` | Also support `GET /api/writeups/:slug` (or keep id + add slug lookup) |
| Frontend list | Click → modal on same page | Click → navigate to `/research/my-writeup-slug` |
| Detail page | Does not exist | New `research.html` (+ optional `blog.html`) |
| Hosting | Static files only | `vercel.json` rewrites so `/research/:slug` serves the detail page |

Blogs already have `slug`. Writeups do **not** — that is the first gap to fix.

---

## Recommended URL design

| Content | URL | Why |
|---------|-----|-----|
| Research & CTF | `/research/:slug` | Readable, shareable, SEO-friendly |
| Security Writings | `/blog/:slug` | Blogs already store `slug` in DB |

Avoid depending only on UUID in the public URL (`/research/a3f2-...`). Use slug for humans; keep UUID as the internal primary key.

Fallback during migration: support **both** slug and UUID in the API so old links still work.

---

## Phase 0 — Decisions (do this first)

Answer these before coding:

1. **Slug or UUID in the URL?** → Prefer **slug** (`/research/linux-privesc-suid`).
2. **Same pattern for blogs?** → Yes: `/blog/sql-injection-real-systems`.
3. **Vercel Root Directory** — Is it `frontend` or repo root?  
   - If Root = `frontend` → put `vercel.json` inside `frontend/`.  
   - If Root = repo → put `vercel.json` at repo root and set `outputDirectory` / rewrites accordingly.
4. **Keep expand accordion on cards?** → Yes (preview steps). Only the **“Read Full Writeup →”** button navigates away.

---

## Phase 1 — Database

### 1.1 Add `slug` to `writeups`

File: `backend/db/schema.sql`

```sql
-- Add to writeups table (new installs)
slug VARCHAR(350) UNIQUE NOT NULL,

-- Plus index
CREATE UNIQUE INDEX IF NOT EXISTS idx_writeups_slug ON writeups(slug);
```

### 1.2 Migration for existing DB (production)

Create: `backend/db/migrations/001_add_writeup_slug.sql`

```sql
ALTER TABLE writeups ADD COLUMN IF NOT EXISTS slug VARCHAR(350);

-- Backfill from title (run once, then fix collisions manually if needed)
UPDATE writeups
SET slug = lower(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE slug IS NULL OR slug = '';

ALTER TABLE writeups ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_writeups_slug ON writeups(slug);
```

### 1.3 Update seed / init

Files:

- `backend/db/init.js`
- `backend/db/seed.js`

Add a `slug` value for every sample writeup, e.g.:

- `sql-injection-banking-login-bypass`
- `linux-privilege-escalation-suid-abuse`

---

## Phase 2 — Backend API

### 2.1 Slug helper (same as blogs)

File: `backend/routes/writeups.js`  
Reuse or extract the `slugify()` helper from `backend/routes/blogs.js`.

On **POST** / **PATCH**:

1. Generate slug from `title` if client did not send one.
2. Ensure uniqueness (`slug`, `slug-2`, `slug-<timestamp>`).
3. Store `slug` in INSERT / UPDATE.

### 2.2 Public GET by slug (or id)

Change:

```http
GET /api/writeups/:id
```

To accept **slug OR uuid**:

```js
// If param looks like UUID → query by id
// Else → query by slug
WHERE (id::text = $1 OR slug = $1) AND published = true
```

### 2.3 List endpoint

`GET /api/writeups` must return `slug` in the list payload:

```sql
SELECT id, slug, title, platform, difficulty, summary, tags, steps, tools_used, ...
```

### 2.4 Admin

File: `frontend/admin.html`

- Optional slug field (auto from title, editable).
- After publish, show public URL preview:  
  `https://fuadportfolio.vercel.app/research/<slug>`

---

## Phase 3 — Frontend pages

### 3.1 New detail page

Create: `frontend/research.html`

Responsibilities:

1. Read `:slug` from the path:
   ```js
   // /research/linux-privesc-suid  →  "linux-privesc-suid"
   // also support ?id= / ?slug= for local file:// testing
   const parts = location.pathname.split('/').filter(Boolean);
   const key = parts[0] === 'research' ? parts[1] : (params.get('slug') || params.get('id'));
   ```
2. `fetch(`${API_BASE}/writeups/${key}`)`.
3. Render title, meta (platform, difficulty, date), markdown body (`marked`).
4. Back link → `/#seclab` or `/`.
5. 404 state if not found.

Optional twin page: `frontend/blog.html` for `/blog/:slug` (same pattern; blogs already have slug).

### 3.2 Update home list links

File: `frontend/index.html`

**Research cards — change CTA from modal to navigation:**

```html
<a class="writeup-btn" href="/research/${w.slug || w.id}">Read Full Writeup →</a>
```

Remove (or stop calling) `openWriteup(id)` modal flow for research.

**Security Writings — same idea:**

```html
<!-- instead of openBlogBySlug / modal -->
<a href="/blog/${post.slug}">…</a>
<!-- or card click → location.href = `/blog/${post.slug}` -->
```

Keep the card grid on the home page as a **listing / teaser** only.

---

## Phase 4 — Vercel routing

Create: `frontend/vercel.json` (if Vercel Root Directory = `frontend`)

```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [
    { "source": "/research/:slug", "destination": "/research.html" },
    { "source": "/blog/:slug", "destination": "/blog.html" }
  ]
}
```

Without this rewrite, visiting `/research/foo` returns **404** because no real folder exists.

### Local testing without Vercel

Open: `research.html?slug=linux-privesc-suid`  
Detail page must support query-param fallback.

Or run: `npx serve frontend` and rely on a simple static server + rewrite plugin if available.

---

## Phase 5 — Cleanup

1. Remove unused writeup/blog modal JS from `index.html` (or keep modal only as emergency fallback).
2. Update project links that currently go to `#seclab` “Writeup” if they should open a specific research page.
3. Update `page_views` / analytics if you track detail pages (`ref_type = 'writeup'`, `ref_id`).
4. Smoke-test:

   - [ ] Create writeup in admin → slug saved in DB  
   - [ ] List API returns `slug`  
   - [ ] Home CTA goes to `/research/<slug>`  
   - [ ] Detail page loads content  
   - [ ] Refresh on detail URL does not 404 on Vercel  
   - [ ] Blog `/blog/<slug>` works the same way  

---

## Suggested file checklist

| Action | File |
|--------|------|
| Edit | `backend/db/schema.sql` |
| Create | `backend/db/migrations/001_add_writeup_slug.sql` |
| Edit | `backend/db/seed.js`, `backend/db/init.js` |
| Edit | `backend/routes/writeups.js` |
| Edit | `frontend/admin.html` |
| Create | `frontend/research.html` |
| Create | `frontend/blog.html` (optional but recommended) |
| Edit | `frontend/index.html` (links only — no modal) |
| Create | `frontend/vercel.json` |

---

## Implementation order (do not skip)

```
1. DB slug column + migration
2. API: create/update + GET by slug
3. Admin: save slug
4. research.html + blog.html detail pages
5. vercel.json rewrites
6. index.html: change links from modal → /research/:slug and /blog/:slug
7. Deploy backend (Render) then frontend (Vercel)
8. Test live URLs
```

**Important:** Deploy backend (slug support) **before** or **with** the frontend that expects slugs. If frontend ships first, links break.

---

## Out of scope for this update

- Full Next.js / React migration (not required; static HTML + rewrite is enough)
- Changing blog table (already has slug)
- Auth / draft preview URLs (can be a later update)

---

## Quick mental model

```
Admin publishes writeup
        ↓
DB stores id + slug + content
        ↓
Home page lists cards → href="/research/{slug}"
        ↓
Vercel rewrite → research.html
        ↓
research.html reads slug from URL → GET /api/writeups/{slug} → render page
```

---

## Status

| Phase | Status |
|-------|--------|
| 0 Decisions | Pending your confirmation |
| 1 Database | Not started |
| 2 API | Not started |
| 3 Frontend pages | Not started |
| 4 Vercel | Not started |
| 5 Cleanup | Not started |

When you are ready, say which phase to implement first (recommended: **Phase 1 + 2** together).
