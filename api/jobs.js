// GET /api/jobs — public job list for candidates.
// The ATS job_uuid is stripped server-side and never reaches the browser.

const KV_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function getJobs() {
  const r = await fetch(`${KV_URL}/get/jobs`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const d = await r.json();
  return d && d.result ? JSON.parse(d.result) : [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({
      error:
        "Storage is not configured. In Vercel: Storage → Create Database → Upstash Redis, connect it to this project, then redeploy.",
    });
  }

  try {
    const jobs = await getJobs();
    // Strip the ATS job id before sending to candidates
    const publicJobs = jobs.map(function (j) {
      const { job_uuid, ...rest } = j;
      return rest;
    });
    return res.status(200).json(publicJobs);
  } catch (err) {
    return res.status(502).json({ error: "Could not load jobs: " + err.message });
  }
}
