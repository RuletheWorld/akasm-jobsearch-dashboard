// Web button -> fires the Mac pipeline via the ngrok-tunneled secret-gated
// trigger. The RUN_SECRET and the current ngrok URL are Vercel env vars, so
// the Mac endpoint is never advertised and the secret never reaches the browser.
const RUN_SECRET = process.env.JOBSEARCH_RUN_SECRET;
const TRIGGER_URL = process.env.JOBSEARCH_TRIGGER_URL; // ngrok https URL

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }
  if (!RUN_SECRET || !TRIGGER_URL) {
    res.status(500).json({ ok: false, error: "trigger not configured" });
    return;
  }
  try {
    const r = await fetch(TRIGGER_URL + "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: RUN_SECRET }),
    });
    const d = await r.json();
    res.status(r.status).json(d);
  } catch (e) {
    res.status(502).json({ ok: false, error: "trigger unreachable: " + String(e) });
  }
}
