# HR Document Checklist — Setup Guide
### Upload to GitHub → Connect Netlify → Done

No terminal or local development required. Everything is done through your browser.

---

## OVERVIEW — What You Need

| Account | URL | Cost |
|---------|-----|------|
| GitHub | github.com | Free |
| Supabase | supabase.com | Free |
| Netlify | netlify.com | Free |

**Total time: ~15 minutes**

---

## STEP 1 — Create the Supabase Database

1. Go to **supabase.com** and sign up (or log in)
2. Click **"New Project"**
3. Fill in:
   - **Project name:** `hr-checklist`
   - **Database password:** pick something strong and **save it**
   - **Region:** East US (or closest to you)
4. Click **"Create new project"** — wait ~2 minutes

### Run the SQL Setup

5. In the left sidebar, click **"SQL Editor"**
6. Click **"+ New query"**
7. Open the file **`database-setup.sql`** (included in the project) in any text editor
8. **Copy the ENTIRE contents** and paste into the Supabase SQL editor
9. Click the green **"Run"** button
10. You should see **"Success. No rows returned"**

### Verify It Worked

11. Click **"Table Editor"** in the left sidebar
12. You should see **4 tables:**
    - `requirements_matrix` → 12 rows
    - `default_requirements` → 12 rows
    - `airport_requirements` → 0 rows (you'll add these later via Admin page)
    - `checklist_transactions` → 0 rows (populated when checklists are completed)

### Copy Your API Keys

13. Click **Settings** (gear icon) → **API**
14. Copy these two values and save them somewhere (notepad, sticky note, etc.):
    - **Project URL** — looks like `https://abcdefg.supabase.co`
    - **anon public key** — long string starting with `eyJ...`

---

## STEP 2 — Upload the Project to GitHub

1. Go to **github.com** and sign up (or log in)
2. Click the **"+"** icon (top right) → **"New repository"**
3. Fill in:
   - **Repository name:** `hr-document-checklist`
   - **Visibility:** Private (recommended)
   - Check **"Add a README file"** ← this creates the repo so you can upload files
4. Click **"Create repository"**

### Upload the Project Files

5. On your new repository page, click **"Add file"** → **"Upload files"**
6. **Extract the project archive** (`hr-checklist-project-v2.tar.gz`) on your computer
   - **Windows:** Right-click → Extract All (you may need 7-Zip for .tar.gz)
   - **Mac:** Double-click the file to extract
7. Open the extracted `hr-checklist` folder
8. **Drag ALL the files and folders** into the GitHub upload area:
   - `src/` (folder)
   - `public/` (folder)
   - `index.html`
   - `package.json`
   - `vite.config.js`
   - `netlify.toml`
   - `.gitignore`
   - `.env.example`
   - `database-setup.sql`
   - `README.md`
9. In the commit message, type: `Initial upload`
10. Click **"Commit changes"**

> **IMPORTANT:** Make sure the files are at the **root** of the repository, NOT inside a subfolder. You should see `package.json` at the top level, not inside `hr-checklist/package.json`. If GitHub created a subfolder, upload the files again by going into each folder.

---

## STEP 3 — Deploy on Netlify

1. Go to **app.netlify.com** and sign up with your **GitHub account**
2. Click **"Add new site"** → **"Import an existing project"**
3. Click **"Deploy with GitHub"**
4. Authorize Netlify to access your GitHub if prompted
5. Select your **"hr-document-checklist"** repository

### Build Settings (should auto-detect, but verify):

6. Confirm these settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
7. **Before clicking Deploy** — expand **"Environment variables"** section
8. Click **"Add a variable"** and add **both** of these:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Your Project URL from Step 1 (e.g., `https://abcdefg.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your anon key from Step 1 (the long `eyJ...` string) |

9. Click **"Deploy site"**
10. Wait 1–2 minutes for the build to complete

### Your site is now live!

Netlify will give you a URL like: `https://random-name-12345.netlify.app`

---

## STEP 4 — Test the Application

Open your Netlify URL and verify each page:

**Checklist Page (main page):**
- Fill in AWB number, origin, destination
- Click "Generate Checklist" — document requirements should appear
- Set each item to Verified or Missing
- Click "Print Checklist" — modal should appear
- Submit and verify PDF downloads

**Admin Page:**
- You should see the 12 seed document requirements
- Try changing a default status
- Try adding an airport code (e.g., NRT)

**History Page:**
- After completing a checklist, it should appear here
- Try searching by AWB number
- Try reprinting a past checklist

---

## STEP 5 — Optional: Custom Site Name

1. In Netlify, go to **Site settings** → **General** → **Site name**
2. Change to something like: `united-cargo-hr-checklist`
3. Your URL becomes: `https://united-cargo-hr-checklist.netlify.app`

---

## TROUBLESHOOTING

**"Checklist is empty / no documents showing"**
→ The SQL didn't run correctly. Go to Supabase → Table Editor → check if `requirements_matrix` has 12 rows. If empty, re-run the SQL.

**"Page loads but nothing works / console shows fetch errors"**
→ Environment variables are missing or wrong. In Netlify: Site settings → Environment variables → verify both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. After adding/changing them, click **Deploys → Trigger deploy → Deploy site** to rebuild.

**"Build failed on Netlify"**
→ Make sure `package.json` is at the ROOT of the repository (not inside a subfolder). Also verify build command is `npm run build` and publish directory is `dist`.

**"404 / page not found when clicking History or Admin"**
→ The `_redirects` file is missing from the `public/` folder, or `netlify.toml` wasn't uploaded. Re-upload those files.

**"Permission denied / Row Level Security errors"**
→ The RLS policies didn't apply. Go to Supabase → SQL Editor and run just Section 6 from the `database-setup.sql` file.

**"Files uploaded to GitHub but in wrong folder"**
→ The files must be at the repository root. If they're nested inside a `hr-checklist/` subfolder, delete them and re-upload just the contents (not the wrapper folder).
