// Returns the Airtable Attachments URL for a record's tailored resume.
// Server-side only: AIRTABLE_API_KEY is a Vercel production env var.
const BASE = "appYgOm56KY7SVDNl";
const TABLE = "tblnJ8RyG0W0NuJN4";
const KEY = process.env.AIRTABLE_API_KEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }
  const id = req.query.record_id;
  if (!id) {
    res.status(400).json({ ok: false, error: "missing record_id" });
    return;
  }
  try {
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${id}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    const atts = (j.fields && j.fields["Attachments"]) || [];
    // Prefer a PDF (the tailored resume from the CI pipeline), but fall back to
    // any attachment (e.g. the Drifter row's GitHub release URL) so it still opens.
    const pdf = atts.find((a) => /\.pdf$/i.test(a.filename || ""));
    const chosen = pdf || atts[0];
    if (chosen) {
      res.status(200).json({ ok: true, url: chosen.url, filename: chosen.filename });
    } else {
      res.status(200).json({ ok: true, url: null, note: "No resume attached to this row yet" });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
