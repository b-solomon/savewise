# 💰 SaveWise — Zero-Knowledge AI-Augmented Personal Wealth Platform

[![Daily Bug Checker](https://github.com/b-solomon/savewise/actions/workflows/bug_check.yml/badge.svg)](https://github.com/b-solomon/savewise/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Security Hardened](https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20Zero--Knowledge-blue.svg)](#security-architecture)

> **A production-grade, privacy-first personal finance platform built for modern wealth management.** SaveWise automates transaction parsing across Indian banking formats (SMS & CSV), secures financial ledgers using hardware-accelerated **AES-256-GCM** encryption at rest, and provides AI-powered financial advisory with strict **Human-in-the-Loop authorization**.

---

## 🌟 What Makes SaveWise Unique & Internship-Ready?

Unlike standard portfolio trackers or basic budgeting dashboards, SaveWise was engineered from the ground up to solve realistic production security, architectural, and usability challenges:

### 1. 🛡️ True Zero-Knowledge & Cryptographic Separation
- **Dedicated Root Master Key**: Authentication signing (`JWT_SECRET`) and database encryption (`ENCRYPTION_MASTER_KEY`) are completely separated.
- **Hardware-Accelerated AES-256-GCM**: Sensitive financial identifiers, transaction amounts, merchants, and raw bank SMS logs are encrypted at rest with unique 128-bit initialization vectors (IV) and cryptographic authentication tags. Even with direct database access, data remains unreadable without the master key.
- **Zero Insecure Fallbacks**: Fails closed in production if security environment variables are absent.

### 2. 🤖 Human-in-the-Loop AI Advisor (Safe Agent Execution & Privacy Boundary)
- AI agents and LLM tools (OpenAI GPT-4o, OpenRouter, Google Gemini, and heuristic fallback) analyze budgets and identify savings opportunities.
- **Privacy Boundary & Data Minimization**: Only pre-aggregated monthly category totals and budget limits are shared with external AI providers. Individual raw ledger entries, bank account numbers, merchant names, and raw SMS logs remain hardware-encrypted and are **never** transmitted to third-party AI models.
- **No Direct Database Writes from AI**: AI proposals (e.g. logging transactions or buying stocks) generate unique time-limited `actionId` tokens with strict parameter validation.
- Writes are executed **only after explicit human verification** (`POST /api/ai/confirm`), eliminating prompt-injection database tampering risks.

### 3. 🏦 Resilient Multi-Bank Financial Ingestion
- **Automated Bank SMS Parser**: Recognizes debit/credit alerts from major Indian banks (SBI, HDFC, ICICI, Axis, Kotak, etc.).
- **Hardened CSV Statement Importer**: Includes **formula-injection protection** (neutralizing leading `=`, `+`, `-`, `@` characters), strict MIME checking, row/column boundaries, and automatic column detection with Multer 2.x.
- **Offline & Cloud Dual-Mode**: Seamlessly connects to remote PostgreSQL (Supabase) with automated failover to local SQLite for offline resilience.

### 4. 🔒 Production Defense-in-Depth Middleware
- **HTTP Security Headers**: Powered by `helmet` with strict Content Security Policy (CSP).
- **Secure Authentication**: HttpOnly, SameSite, Secure cookie-based authentication eliminates XSS token-theft paths.
- **API Rate Limiting**: Tiered request rate limiting for authentication (`authLimiter`), AI endpoints (`aiLimiter`), and general API traffic (`apiLimiter`).
- **Distributed Token Revocation Store**: Supports active user logout and immediate JWT revocation via Redis with automatic in-memory fallback.
- **Origin Isolation**: Enforces fail-closed CORS domain whitelisting.

---

## 🏗️ Architecture & Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                      React 19 + Vite                        │
│          TailwindCSS + Lucide Icons + Framer Motion         │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON (Restricted CORS)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express.js Security API                   │
│   Helmet  •  Rate Limiting  •  JWT Revocation  •  Pino Logs │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│  AES-256-GCM Crypto Engine  │ │   Safe AI Agent Gateway     │
│   PBKDF2 Key Derivation     │ │  Human-in-the-Loop Action   │
│   Encrypted Ledger at Rest  │ │    Confirmation Boundary    │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│       Dual Database Engine (PostgreSQL / SQLite)            │
│   Parametric SQL Queries  •  User-Scoped Tenant Isolation   │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide React, Framer Motion.
- **Backend**: Node.js (ESM), Express 4, JWT, Bcrypt, Helmet, Express-Rate-Limit, Multer.
- **Database**: PostgreSQL (pg pooler) with automatic SQLite local fallback.
- **Cryptography**: Node.js `crypto` with `aes-256-gcm`, `pbkdf2` (100,000 iterations), `sha512`.
- **AI Integrations**: OpenAI API, OpenRouter API (Gemini / Claude / Llama models), local heuristic fallback engine.

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js 20+ (Node.js 22 LTS recommended)
- Git

### 1. Clone & Setup Environment
```bash
git clone https://github.com/b-solomon/savewise.git
cd savewise

# Copy environment template
cp .env.example server/.env
```

### 2. Configure Environment Variables (`server/.env`)
```env
PORT=4000
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
ENCRYPTION_MASTER_KEY=your_secure_dedicated_master_key_32_chars
ENCRYPTION_SALT=your_encryption_salt_value
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 3. Install & Run Diagnostics
```bash
# Install backend dependencies
cd server
npm install

# Run comprehensive automated health check & security suite
npm test
```

### 4. Start Development Servers
```bash
# Start backend server (port 4000)
npm run dev

# In another terminal, start client
cd ../client
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🧪 Comprehensive Automated Test Suite

SaveWise includes a built-in automated test and diagnostic harness:
```bash
node server/scripts/bugCheck.js
```
The suite verifies:
- Core environment configuration & master key availability
- End-to-end AES-256-GCM encryption/decryption roundtrip
- Multi-format SMS parsing and category classification
- Database connectivity, table schemas, and tenant isolation
- Yahoo Finance live quote and ticker resolution
- Password entropy and complexity validation
- **CSV Formula Injection Sanitization**
- **AI Action Human Confirmation IDOR Authorization Safeguards**

---

## 💼 Resume Bullet Points

Feel free to highlight these concrete engineering contributions on your resume:

- **Engineered Zero-Knowledge Financial Architecture**: Designed an end-to-end encryption engine using AES-256-GCM and PBKDF2 (100k iterations) separating JWT auth secrets from a dedicated master key; eliminated all plaintext financial database columns and implemented HttpOnly cookie session management to protect against XSS token theft.
- **Implemented Safe AI Agent Execution Flow & Privacy Boundary**: Architected a Human-in-the-Loop confirmation gateway for LLM tool executions, eliminating prompt-injection write vectors by requiring cryptographically verified user approval before mutating database records, while enforcing data minimization so external LLMs receive only pre-aggregated summaries.
- **Hardened Production Node.js / Express Backend**: Deployed Helmet security headers with CSP, fail-closed CORS whitelisting, tiered rate limiting (`express-rate-limit`), and a distributed Redis JWT revocation store with automatic memory fallback.
- **Built Resilient Multi-Bank Ingestion Pipeline**: Developed bank SMS regex parsers and a robust CSV statement importer featuring automatic header mapping, Multer 2.x security upgrades, and formula injection protection (`=`, `@`, `+`, `-`).
- **Designed Resilient Hybrid Database Layer**: Integrated PostgreSQL with automatic fallback to SQLite and implemented a CI/CD automated diagnostic pipeline executing 28 automated health and security checks on every pull request and push.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
