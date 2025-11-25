Build a complete Automated Expense Tracker Web App.
Tech stack: Next.js (App Router), TypeScript, TailwindCSS, Supabase (PostgreSQL), Node.js API Routes.
The app must extract expenses automatically from Gmail and SMS (Twilio-forwarded messages).

Core Requirements

User Authentication

Email/password + Supabase Auth.

Auth-protected dashboard.

Gmail Integration

Use Gmail OAuth 2.0 (read-only scope).

Create a flow for users to connect their Gmail account.

Backend job to poll Gmail every few minutes OR use Gmail Watch API.

Fetch emails that match receipt keywords:
"receipt", "order", "payment", "transaction", "invoice".

Extract:

amount

vendor

date

currency

reference ID

Store original email content in a "raw" field but keep parsed fields in structured columns.

Use regex for fast parsing and fallback to an LLM extraction endpoint (mock for now).

SMS Parsing (Twilio)

Set up a webhook route /api/sms.

Parse incoming SMS forwarded from Twilio.

Look for:

amount

vendor/bank

date

Insert as transactions in the DB.

Database (Supabase / PostgreSQL)
Create tables:

users

transactions

id

user_id

source (gmail | sms | manual)

amount

currency

vendor

date

category

confidence_score

raw_text

created_at

rules

user_id

pattern

category

enabled

Transaction Dashboard

Beautiful, modern UI using Tailwind.

Show:

Recent transactions

Category totals

Week/month overview

Allow editing & recategorizing.

Add search + filters.

Rules Engine

Allow users to create rules like:
“If vendor contains 'Uber', category = Transport”

Apply rules automatically after parsing.

Manual CSV Upload

Upload CSV bank statements.

Parse rows into transactions.

Error Logging

Add Sentry or simple logging for failed parses.

Security

Store Gmail tokens encrypted.

Allow users to disconnect & delete data.

Deployment

Deploy on Vercel.

Use Supabase hosted database.

Include .env.example with all required env vars.

UI Requirements

Clean, minimal dashboard.

Sidebar navigation: Dashboard, Transactions, Rules, Settings.

Charts using react-chartjs-2 (expense per category, monthly spend).

Dark mode toggle.

Smooth animations with Framer Motion.

APIs to Implement

/api/gmail/init → Start Gmail OAuth flow

/api/gmail/callback → Handle OAuth callback

/api/gmail/sync → Fetch & parse emails

/api/sms → Twilio webhook

/api/transactions → CRUD

/api/rules → CRUD

Parsing Logic

Implement a parser utility:

First pass: regex

Example:

const amount = text.match(/(\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{2}))/);
const vendor = extractVendor(text); // simple function
const date = extractDate(text);


If parsing fails, call a mock LLM endpoint:

POST /api/llm/parse

Deliverables

Generate:

Full file structure

All API routes

All React components

Regex parser

Supabase SQL migrations

Working OAuth flow for Gmail

Twilio webhook

Dashboard UI & transactions page

Rules settings page

.env.example

Deployment instructions