// POST /api/apply — candidate application.
// Receives the internal job id, looks up the ATS job_uuid on the server,
// and pushes the lead to the ATS. The job_uuid never touches the browser.
//
// Rate limited to one application per mobile number every 3 days —
// applying to multiple jobs in a short window causes issues downstream
// in the ATS, so repeat attempts are rejected before reaching it.

const WEBHOOK_URL = "https://ats.mopid.me/api/v1.0/add-simple-candidate";

const APPLY_COOLDOWN_SECONDS = 3 * 24 * 60 * 60;

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

async function getLastApplied(mobile) {
  const r = await fetch(`${KV_URL}/get/applied:${mobile}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const d = await r.json();
  return d && d.result ? d.result : null;
}

// Sets a self-expiring marker (auto-cleared by Redis after the cooldown)
// so a mobile number can't be used to apply again until it's gone.
async function markApplied(mobile) {
  const value = encodeURIComponent(new Date().toISOString());
  await fetch(
    `${KV_URL}/set/applied:${mobile}/${value}/EX/${APPLY_COOLDOWN_SECONDS}`,
    { method: "POST", headers: { Authorization: `Bearer ${KV_TOKEN}` } }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "Storage is not configured." });
  }

  const { job_id, first_name, last_name, email, mob_no } = req.body || {};

  if (!job_id || !first_name || !email || !mob_no) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // Normalize mobile: keep digits, ensure 91 prefix
  let digits = String(mob_no).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length !== 10) {
    return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });
  }
  const mobile = "91" + digits;

  try {
    const lastApplied = await getLastApplied(mobile);
    if (lastApplied) {
      return res.status(429).json({
        error:
          "You've already applied to a job in the last 3 days. Please wait before applying again — our team will be in touch soon.",
      });
    }

    const jobs = await getJobs();
    const job = jobs.find(function (j) { return j.id === job_id; });
    if (!job) {
      return res.status(404).json({ error: "This job is no longer available." });
    }

    const payload = {
      job_uuid: job.job_uuid,
      first_name: String(first_name),
      last_name: String(last_name || ""),
      email: String(email),
      mob_no: mobile,
      source: "Career Page",
    };

    const atsRes = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await atsRes.text();

    if (!atsRes.ok) {
      return res
        .status(502)
        .json({ error: "Could not submit your application. Please try again." });
    }

    await markApplied(mobile);

    return res.status(200).json({ ok: true, message: text });
  } catch (err) {
    return res
      .status(502)
      .json({ error: "Could not submit your application: " + err.message });
  }
}
