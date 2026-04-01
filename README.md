# Human Remains Document Checklist & Verification

A web application for United Cargo operations to verify and manage document compliance for human remains shipments. Built with React + Vite, hosted on Netlify, with Supabase as the database.

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Browser    │────▶│   Netlify    │────▶│    Supabase      │
│  (React App) │     │  (Static)    │     │  (PostgreSQL DB) │
└─────────────┘     └──────────────┘     └──────────────────┘
                                          ├─ requirements_matrix
                                          ├─ airport_requirements
                                          ├─ default_requirements
                                          └─ checklist_transactions
```

## Features

- **Intake Form**: Collects AWB, origin, destination, routing, flight info, remains type
- **Dynamic Checklist**: Generates document requirements based on destination airport
- **Matrix Database**: Airport-specific requirement statuses (Required / Required-Copies OK / Not Required)
- **Default Fallback**: Standard checklist when destination isn't in the matrix
- **Verification Flow**: Verified / Missing dropdowns for each document
- **Print Modal**: Warning for missing docs, certification for verified checklists
- **PDF Generation**: Single-page PDF with red border, all shipment details, signature lines
- **Transaction History**: Searchable log of all completed checklists with reprint capability
- **Admin Panel**: Full CRUD for requirements, default statuses, and airport-specific overrides

---

## Setup Instructions

### 1. Create Supabase Project (Free)

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click **"New Project"**
3. Name it (e.g., `hr-checklist`) and set a database password
4. Wait for the project to provision (~2 minutes)

### 2. Run the Database Setup SQL

1. In Supabase dashboard, go to **SQL Editor** → **New query**
2. Open `src/lib/supabase.js` and copy the entire SQL block (everything between `/*` and `*/`)
3. Paste it into the SQL editor and click **Run**
4. This creates all 4 tables, indexes, seed data, and RLS policies

### 3. Get Your API Keys

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy:
   - **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - **anon/public key** (the long JWT string)

### 4. Configure the App

Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

### 6. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - HR Document Checklist"
git remote add origin https://github.com/YOUR_USERNAME/hr-document-checklist.git
git push -u origin main
```

### 7. Deploy to Netlify

1. Go to [netlify.com](https://netlify.com) and connect your GitHub repo
2. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Add environment variables in Netlify:
   - **Site settings** → **Environment variables**
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Trigger a deploy

---

## Database Schema

### `requirements_matrix`
The master list of document requirements. Each row is a document type.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_name | TEXT | Name of the document |
| description | TEXT | Brief description |
| applies_to | TEXT | ALL, BOTH, HUMAN_REMAINS, HUMAN_REMAINS_ASH |
| sort_order | INT | Display order |
| is_active | BOOL | Whether it appears on checklists |

### `airport_requirements`
Airport-specific overrides. Maps requirement × airport → status.

| Column | Type | Description |
|--------|------|-------------|
| requirement_id | UUID | FK to requirements_matrix |
| airport_code | CHAR(3) | ICAO 3-letter code |
| status | TEXT | Required / Required - Copies OK / Not Required |

### `default_requirements`
Default status for each requirement (used when destination is NOT in airport_requirements).

### `checklist_transactions`
Historical log of every completed checklist, including the full checklist items as JSONB.

---

## Application Flow

```
1. User enters shipment info (AWB, origin, destination, etc.)
       │
2. System checks: Is destination in airport_requirements?
       │
       ├── YES → Load airport-specific statuses
       │          Filter out "Not Required" items
       │
       └── NO  → Load default_requirements statuses
                  Filter out "Not Required" items
       │
3. Display checklist with Verified/Missing dropdowns
       │
4. User clicks "Print Checklist"
       │
       ├── Has Missing items → WARNING modal
       │   "Contact Supervisor on Duty and TrustUA"
       │
       └── All Verified → SUCCESS modal
           User enters V/U number
           Timestamp captured
       │
5. Transaction saved to database
6. PDF generated and downloaded
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Routing | React Router v6 |
| Database | Supabase (PostgreSQL) |
| PDF Generation | jsPDF + jspdf-autotable |
| Hosting | Netlify |
| Fonts | Barlow Condensed + IBM Plex Sans |
