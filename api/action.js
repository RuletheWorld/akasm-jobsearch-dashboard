// Live Airtable status writer for the job-search dashboard.
// Server-side only: AIRTABLE_API_KEY is a Vercel production env var.
const BASE = "appYgOm56KY7SVDNl";
const TABLE = "tblnJ8RyG0W0NuJN4";
const KEY = process.env.AIRTABLE_API_KEY;

const STATUS_MAP = {
  mark_applied: "Applied",
  mark_interviewing: "Interviewing",
  mark_offer: "Offer",
  reject: "Rejected",
};

async function patch(recId, fields) {
  const url = `https://api.airtable.com/v0/${BASE}/${TABLE}/${recId}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  return j;
}

async function getNotes(recId) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${recId}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const j = await r.json();
  return (j.fields && j.fields["Notes"]) || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }
  if (!KEY) {
    res.status(500).json({ ok: false, error: "missing AIRTABLE_API_KEY env" });
    return;
  }
  const body = req.body || {};
  const action = body.action;
  const recId = body.record_id;
  if (!action) {
    res.status(400).json({ ok: false, error: "missing action" });
    return;
  }
  // refresh just tells the board to re-pull (live board fetches /api/records)
  if (action === "refresh") {
    res.status(200).json({ ok: true });
    return;
  }
  if (!recId) {
    res.status(400).json({ ok: false, error: "missing record_id" });
    return;
  }
  try {
    if (action === "reject") {
      const notes = await getNotes(recId);
      const today = new Date().toISOString().slice(0, 10);
      await patch(recId, {
        Status: "Rejected",
        Notes: `${notes}\n[dashboard ${today}] Rejected via board`.trim(),
      });
      res.status(200).json({ ok: true });
      return;
    }
    const newStatus = STATUS_MAP[action];
    if (!newStatus) {
      res.status(400).json({ ok: false, error: `unknown action: ${action}` });
      return;
    }
    const notes = await getNotes(recId);
    const today = new Date().toISOString().slice(0, 10);
    const fields = {
      Status: newStatus,
      Notes: `${notes}\n[dashboard ${today}] -> ${newStatus}`.trim(),
    };
    if (newStatus === "Applied") fields["Application Date"] = today;
    await patch(recId, fields);
    res.status(200).json({ ok: true, status: newStatus });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
