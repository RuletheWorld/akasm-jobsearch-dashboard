// Live Airtable reader for the job-search dashboard.
// The AIRTABLE_API_KEY is a Vercel production env var (server-side only).
const BASE = "appYgOm56KY7SVDNl";
const TABLE = "tblnJ8RyG0W0NuJN4";
const KEY = process.env.AIRTABLE_API_KEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }
  if (!KEY) {
    res.status(500).json({ ok: false, error: "missing AIRTABLE_API_KEY env" });
    return;
  }
  try {
    const all = [];
    let offset;
    do {
      const url = `https://api.airtable.com/v0/${BASE}/${TABLE}?pageSize=100${offset ? `&offset=${offset}` : ""}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      (j.records || []).forEach((rec) => {
        const f = rec.fields || {};
        all.push({
          id: rec.id,
          company: f["Company Name"] || "",
          title: f["Job Title"] || "",
          status: f["Status"] || "Ready",
          link: f["Job Posting Link"] || "",
          location: f["Job Location"] || "",
          salary: f["Expected Salary"] || "",
          source: f["Job Source"] || "",
          fit: (f["Fit Score"] || "").toString(),
          notes: f["Notes"] || "",
          app_date: f["Application Date"] || "",
          attachments: (f["Attachments"] || []).map((a) => a.url),
        });
      });
      offset = j.offset;
    } while (offset);
    res.status(200).json({ ok: true, records: all });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
