// POST /api/admin — admin actions: login, list, add, delete.
// Protected by Basic auth. Default credentials: admin@mopid.me / Welcome@123
// (override with ADMIN_EMAIL / ADMIN_PASSWORD env variables in Vercel).

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@mopid.me";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Welcome@123";

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

async function saveJobs(jobs) {
  await fetch(`${KV_URL}/set/jobs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(jobs),
  });
}

function isAuthed(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep === -1) return false;
  const email = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);
  return email === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAuthed(req)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({
      error:
        "Storage is not configured. In Vercel: Storage → Create Database → Upstash Redis, connect it to this project, then redeploy.",
    });
  }

  const { action, job, id } = req.body || {};

  try {
    if (action === "login") {
      return res.status(200).json({ ok: true });
    }

    if (action === "list") {
      const jobs = await getJobs();
      return res.status(200).json(jobs);
    }

    if (action === "add") {
      if (!job || !job.title || !job.job_uuid) {
        return res
          .status(400)
          .json({ error: "Job title and ATS Job Id are required." });
      }
      const jobs = await getJobs();
      const newJob = {
        id: "j_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        job_uuid: String(job.job_uuid).trim(),
        title: String(job.title).trim(),
        location: String(job.location || "").trim(),
        mode: String(job.mode || "In Office").trim(),
        map_link: String(job.map_link || "").trim(),
        salary: String(job.salary || "").trim(),
        languages: String(job.languages || "").trim(),
        jd: String(job.jd || "").trim(),
        created_at: new Date().toISOString(),
      };
      jobs.unshift(newJob);
      await saveJobs(jobs);
      return res.status(200).json(jobs);
    }

    if (action === "delete") {
      if (!id) return res.status(400).json({ error: "Job id is required." });
      let jobs = await getJobs();
      jobs = jobs.filter(function (j) { return j.id !== id; });
      await saveJobs(jobs);
      return res.status(200).json(jobs);
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    return res.status(502).json({ error: "Storage error: " + err.message });
  }
}
