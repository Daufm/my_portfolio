require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'portfolio_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function init() {
  const client = await pool.connect();
  console.log('📦 Initializing database schema...');
  try {
    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Schema created');

    // Seed admin
    const email = process.env.ADMIN_EMAIL;
    const plain = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME || 'Fuad Mohammed';
    if (!email || !plain) {
      console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed');
      return;
    }
    const hash = await bcrypt.hash(plain, 12);
    await client.query(
      `INSERT INTO admins (name, email, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password = $3, name = $1`,
      [name, email, hash]
    );
    console.log(`✅ Admin seeded: ${email}`);

    // Seed sample blog posts
    await client.query(`
      INSERT INTO blog_posts (title, slug, excerpt, content, cover_emoji, category, tags, read_time_min, published, published_at)
      VALUES
        ('SQL Injection Explained in Real Systems',
         'sql-injection-real-systems',
         'How attackers exploit SQLi in production banking systems — real payloads and defense strategies.',
         '## What is SQL Injection?\n\nSQL Injection remains one of the most critical vulnerabilities...',
         '💉', 'cybersecurity', ARRAY['SQLi','OWASP','Banking'], 7, true, NOW()),
        ('TryHackMe Privilege Escalation Walkthrough',
         'thm-privesc-walkthrough',
         'Step-by-step guide through a Linux PrivEsc room from foothold to root.',
         '## Room Overview\n\nThis walkthrough covers a TryHackMe Linux privilege escalation room...',
         '🏆', 'ctf', ARRAY['PrivEsc','Linux','TryHackMe'], 10, true, NOW()),
        ('Building Secure APIs with FastAPI',
         'secure-apis-fastapi',
         'Production patterns for FastAPI — OAuth2, JWT, SQL injection prevention.',
         '## Why FastAPI?\n\nFastAPI''s type system makes it ideal for secure backends...',
         '⚡', 'webdev', ARRAY['FastAPI','Python','Security','API'], 8, true, NOW()),
        ('Common Web Vulnerabilities and Fixes',
         'common-web-vulnerabilities',
         'OWASP Top 10 practical breakdown with hands-on remediation code.',
         '## OWASP Top 10\n\nUnderstanding these vulnerabilities is essential for every developer...',
         '🕷️', 'tutorial', ARRAY['OWASP','XSS','CSRF','Security'], 12, true, NOW())
      ON CONFLICT (slug) DO NOTHING;
    `);
    console.log('✅ Sample blog posts seeded');

    // Seed sample projects
    await client.query(`
      INSERT INTO projects (title, type, description, tech_stack, security_notes, github_url, featured, sort_order)
      VALUES
        ('Secure Task Management System','dev',
         'Enterprise task manager with JWT auth, RBAC, and audit logging.',
         ARRAY['React','Node.js','MongoDB','JWT','Express'],
         'JWT + RBAC, bcrypt hashing, rate limiting, audit log',
         'https://github.com/Daufm/Task-Flow', true, 1),
        ('E-Commerce Platform','dev',
         'Full-featured e-commerce with Stripe, cart system, and admin dashboard.',
         ARRAY['MERN','Redux','Stripe API'],
         'CSRF protection, input sanitization, secure payment pipeline',
         'https://github.com/Daufm/ecommerce-backend', true, 2),
        ('Learning Ethiopia Platform','dev',
         'A Comprehensive Platform for Learning Amharic and English for Ethiopian students and professionals.',
         ARRAY['React','Node.js','MongoDB','JWT','Express'],
         'OAuth2 + JWT, ORM prevents SQLi, rate limiting',
         'https://github.com/Daufm/Learn_Ethiopia', true, 3),
        ('VAPT Report: Web App Security Testing','sec',
         'Comprehensive vulnerability assessment for a financial web application — 12 CVEs discovered.',
         ARRAY['Burp Suite','Nmap','OWASP ZAP','Python'],
         '12 CVEs • SQLi, XSS, IDOR, Broken Auth — full PoC + remediation',
         'https://github.com/Daufm/VAPT-Report-for-Web-App-Security-Testing', true, 4),
        ('Vulnerability Scanning Automation','sec',
         'AI Powered Python Nmap (Network Scanner)',
         ARRAY['Python','Nmap','Gobuster','Bash'],
         'Reduces manual scanning time by 70% — structured report output',
         'https://github.com/Daufm/AI-powered_Network_Scanner', true, 5),
         ('Api Performance Testing','dev',
          'API Performance Testing is a performance testing tool for APIs.',
          ARRAY['Python','Node.js','MongoDB','JWT','Express'],
          'OAuth2 + JWT, ORM prevents SQLi, rate limiting',
          'https://github.com/Daufm/api-performance-checker', true, 6)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Sample projects seeded');

    // Seed writeups
    await client.query(`
      INSERT INTO writeups (title, platform, difficulty, summary, content, tags, steps, tools_used, published)
      VALUES
        ('SQL Injection — Banking Login Bypass',
         'tryhackme','medium',
         'Classic blind SQLi on a login endpoint leading to full account takeover.',
         '## Overview\n\nBoolean-based blind SQL injection on financial login page...',
         ARRAY['Web','SQLi','Authentication'],
         ARRAY['Identified injectable login form','Confirmed with payload: admin'' OR ''1''=''1'' --','Boolean-based blind extraction','Dumped credential table','Cracked MD5 hashes and escalated to admin'],
         ARRAY['Burp Suite','SQLMap','Hashcat'], true),
        ('Linux Privilege Escalation — SUID Abuse',
         'tryhackme','hard',
         'Chained CVE exploitation to SUID binary abuse achieving root.',
         '## Overview\n\nChained vulnerability from Apache CVE to SUID abuse...',
         ARRAY['PrivEsc','Linux','SUID'],
         ARRAY['Initial foothold via CVE-2021-41773','Stabilized shell with pty','LinPEAS enumeration — found SUID on /usr/bin/find','GTFOBins exploit: find . -exec /bin/sh','Root achieved'],
         ARRAY['Nmap','LinPEAS','GTFOBins'], true)
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Sample writeups seeded');

    console.log('\n🎉 Database fully initialized and seeded!\n');
  } finally {
    client.release();
    await pool.end();
  }
}

init().catch(err => {
  console.error('❌ Init failed:', err.message);
  process.exit(1);
});
