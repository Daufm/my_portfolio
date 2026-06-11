-- ══════════════════════════════════════════════════════════
--  Fuad Mohammed Umer — Portfolio Database Schema
--  Run: psql -U postgres -d portfolio_db -f schema.sql
-- ══════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ─── ADMIN USERS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  avatar_url  VARCHAR(500),
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BLOG POSTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         VARCHAR(300) NOT NULL,
  slug          VARCHAR(350) UNIQUE NOT NULL,
  excerpt       TEXT,
  content       TEXT NOT NULL,           -- Markdown source
  cover_emoji   VARCHAR(10) DEFAULT '📝',
  category      VARCHAR(60) NOT NULL
    CHECK (category IN ('cybersecurity','webdev','ctf','tutorial')),
  tags          TEXT[] DEFAULT '{}',
  read_time_min INTEGER DEFAULT 5,
  published     BOOLEAN DEFAULT FALSE,
  views         INTEGER DEFAULT 0,
  author_id     UUID REFERENCES admins(id) ON DELETE SET NULL,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_published    ON blog_posts(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_category     ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_slug         ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_tags         ON blog_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blog_title_search ON blog_posts USING GIN(title gin_trgm_ops);

-- ─── PROJECTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR(200) NOT NULL,
  type            VARCHAR(20) NOT NULL CHECK (type IN ('dev','sec')),
  description     TEXT NOT NULL,
  long_desc       TEXT,
  tech_stack      TEXT[] DEFAULT '{}',
  security_notes  TEXT,
  github_url      VARCHAR(500),
  demo_url        VARCHAR(500),
  featured        BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_type     ON projects(type);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured, sort_order);

-- ─── SECURITY WRITEUPS / CTF ───────────────────────────────
CREATE TABLE IF NOT EXISTS writeups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(300) NOT NULL,
  platform    VARCHAR(60)  NOT NULL
    CHECK (platform IN ('tryhackme','hackthebox','ctf','vapt','custom')),
  difficulty  VARCHAR(20)  NOT NULL
    CHECK (difficulty IN ('easy','medium','hard','insane')),
  summary     TEXT NOT NULL,
  content     TEXT NOT NULL,             -- full Markdown writeup
  tags        TEXT[] DEFAULT '{}',
  steps       TEXT[] DEFAULT '{}',       -- quick step list
  tools_used  TEXT[] DEFAULT '{}',
  flag        VARCHAR(200),              -- redacted for public
  published   BOOLEAN DEFAULT FALSE,
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writeups_platform   ON writeups(platform);
CREATE INDEX IF NOT EXISTS idx_writeups_difficulty ON writeups(difficulty);
CREATE INDEX IF NOT EXISTS idx_writeups_published  ON writeups(published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_writeups_tags       ON writeups USING GIN(tags);

-- ─── CONTACT MESSAGES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(200) NOT NULL,
  subject     VARCHAR(300),
  message     TEXT NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  status      VARCHAR(20) DEFAULT 'unread'
    CHECK (status IN ('unread','read','replied','archived')),
  replied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_messages(status, created_at DESC);

-- ─── PAGE ANALYTICS (lightweight) ─────────────────────────
CREATE TABLE IF NOT EXISTS page_views (
  id         BIGSERIAL PRIMARY KEY,
  page       VARCHAR(200) NOT NULL,
  ref_type   VARCHAR(20), -- 'blog','project','writeup'
  ref_id     UUID,
  ip_hash    VARCHAR(64), -- SHA-256 of IP, never raw
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_page      ON page_views(page, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_ref       ON page_views(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_views_created   ON page_views(created_at DESC);

-- ─── AUTO-UPDATE updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['admins','blog_posts','projects','writeups'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END $$;
