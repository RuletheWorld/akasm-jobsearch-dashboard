// Web "Run search" -> triggers the GitHub Actions pipeline (fully cloud, no Mac).
// Holds GITHUB_TOKEN + repo as Vercel env vars; the button just calls this.
const GH_TOKEN = process.env.GH_PAT;            // a PAT with actions:write on the repo
const REPO = process.env.GH_REPO || "RuletheWorld/test-akasm-jobsearch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }
  if (!GH_TOKEN) {
    res.status(500).json({ ok: false, error: "GH_PAT not configured" });
    return;
  }
  try {
    const url = `https://api.github.com/repos/${REPO}/actions/workflows/pipeline.yml/dispatches`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "jobsearch-dashboard",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (r.status === 204) {
      res.status(202).json({ ok: true, status: "pipeline dispatched",
        note: "GitHub Actions is running the hunt in the cloud; board refreshes when it finishes." });
    } else {
      const t = await r.text();
      res.status(r.status).json({ ok: false, error: "dispatch failed: " + t.slice(0, 200) });
    }
  } catch (e) {
    res.status(502).json({ ok: false, error: "github unreachable: " + String(e) });
  }
}
