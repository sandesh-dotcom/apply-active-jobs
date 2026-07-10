# Mopid Careers — Job Board + Lead Generation

Candidate-facing job board where candidates browse jobs and apply. Applications
are pushed straight into the Mopid ATS. Jobs are managed from a private admin page.

## Pages
- `/` (index.html) — candidate page: job list → job details → apply form → success
- `/admin.html` — admin page: sign in, add jobs, remove jobs

## APIs
- `api/jobs.js` — GET public job list (ATS Job Id stripped server-side)
- `api/apply.js` — POST application; maps job → ATS job_uuid on the server and
  pushes the lead (source: "Career Page", mobile auto-prefixed with 91)
- `api/admin.js` — POST admin actions (login / list / add / delete), Basic auth

## Setup on Vercel (one-time)

1. Deploy this folder (CLI: `vercel` then `vercel --prod`, or import from GitHub).
2. **Add job storage** — jobs need a database:
   - Vercel dashboard → your project → **Storage** tab → **Create Database**
   - Choose **Upstash Redis** (free tier is plenty)
   - Connect it to this project — Vercel adds the env variables automatically
   - **Redeploy** the project
3. Done. Open `/admin.html`, sign in, and add your first job.

## Admin credentials
Default: `admin@mopid.me` / `Welcome@123`

To change them, add env variables in Vercel (Settings → Environment Variables):
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
then redeploy. Strongly recommended before sharing the link widely.

## Security notes
- The ATS Job Id is never sent to candidates' browsers — the public API strips
  it, and the apply API resolves it server-side.
- The admin page is protected by the email/password above. Change the default
  password after first deploy.
