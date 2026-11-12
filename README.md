# ReceiptVault

**VAT-ready receipts for UAE businesses and their accountants.**

Staff snap receipts. ReceiptVault reads the supplier, TRN, 5% VAT and total, flags receipts you can't claim VAT on, and gives your accountant a clean export for the quarterly VAT return.

## Who it's for

| User | What they get |
| --- | --- |
| **Owner** of a VAT-registered SME or freelancer in the UAE | One place for every receipt, live recoverable VAT for the quarter, and warnings before VAT is lost to missing TRNs |
| **Accountant / bookkeeping firm** | Clients' receipts already sorted by VAT quarter, a review queue, and a CSV export for the VAT 201 return. One login across many client companies |
| **Staff** | Upload receipts from their phone; they only see their own |

The business (or the accounting firm, per client) pays a monthly fee per company.

## Features

- **Company workspaces** with owner, accountant and staff roles, invites, and a company switcher for accountants with many clients. Invited people sign up with the invited email and leave company name blank to join only that company
- **Receipt scanning** with Google Cloud Document AI: supplier, TRN, date, line items, VAT, currency (converted to AED)
- **Manual entry** with live TRN check and one-click 5% VAT calculation
- **Review workflow**: pending, approved, rejected, with notes. Only owners and accountants review. Staff can't change approved receipts
- **Only approved receipts count as recoverable VAT**: a receipt's VAT is claimable when it is approved, has a valid supplier TRN, has VAT, and isn't in a blocked category (entertainment). Receipts not yet approved show separately as "Waiting for review"
- **Supplier TRN check**: receipts without a valid 15-digit TRN are flagged, since their VAT can't be recovered
- **VAT quarter view**: VAT 201 box 9 figures (standard rated expenses and recoverable VAT), filing due date, a "before you file" checklist, VAT by category, and why VAT was left out (missing TRN, entertainment, rejected, waiting for review)
- **Accountant export**: CSV with supplier, TRN, net/VAT/gross in AED, claimable flag, issue and review status
- **UAE business categories**: Fuel & Vehicle, Utilities (DEWA/SEWA), Government & Licensing, Telecom, and more, auto-detected from the supplier name
- **Demo company**: "Explore a demo Dubai company" creates a private sample workspace with real-looking UAE receipts

## Stack

- **Backend**: Flask 3, SQLAlchemy, PostgreSQL, JWT auth, Google Document AI (optional), Google Cloud Storage (optional, falls back to local disk)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Recharts

## Run locally

```bash
# Database
docker run -d --name rv-db -e POSTGRES_DB=receiptvault -e POSTGRES_USER=rv -e POSTGRES_PASSWORD=rv -p 5432:5432 postgres:15-alpine

# Backend (http://localhost:5000)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL=postgresql://rv:rv@localhost:5432/receiptvault
python app.py

# Frontend (http://localhost:3000, proxies /api to the backend)
cd frontend
npm install
echo 'VITE_API_URL=/api/v1' > .env.local
npm run dev
```

Receipt scanning needs `DOCUMENT_AI_PROCESSOR_ID` and Google credentials. Without them, uploads are stored and marked for manual entry. Without `GCS_BUCKET_NAME`, images are stored in `backend/uploads/`.

Tables and new columns are created on startup. Existing single-user accounts are moved into their own company automatically.

## API overview

All company endpoints use the `Authorization: Bearer <token>` header and an optional `X-Company-Id` header (defaults to the user's first company).

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/auth/register` | Create account and company (`company_name`, `company_trn`) |
| `POST /api/v1/auth/login`, `/auth/guest-login` | Sign in, or open a demo company |
| `GET/POST /api/v1/companies/` | List or create companies |
| `GET/PUT /api/v1/companies/current` | Company details (owner edits) |
| `GET /api/v1/companies/current/members`, `POST .../invites` | Team and invites |
| `POST /api/v1/receipts/upload`, `/receipts/manual` | Add receipts |
| `GET /api/v1/receipts/?status=&issue=missing_trn` | List receipts |
| `POST /api/v1/receipts/<id>/review` | Approve or reject (owner, accountant) |
| `GET /api/v1/vat/periods`, `/vat/summary?period=YYYY-MM` | VAT quarters and summary |
| `GET /api/v1/vat/export?period=YYYY-MM` | Accountant CSV (owner, accountant) |

## Roadmap

- Email delivery for invites
- Zoho Books and Xero export
- Arabic interface
- Saudi Arabia, Bahrain and Oman VAT rules

VAT figures are a guide for your accountant, not tax advice.
