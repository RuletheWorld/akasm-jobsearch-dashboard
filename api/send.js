// Sends a tailored application email via Gmail SMTP, attaching the PDF from
// Airtable, then marks the row Applied. NEVER sends without an explicit
// approve=true from the dashboard button (that click IS the user's consent).
//
// Server-side only. Env: AIRTABLE_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD.
import nodemailer from "nodemailer";
const BASE = "appYgOm56KY7SVDNl";
const TABLE = "tblnJ8RyG0W0NuJN4";
const KEY = process.env.AIRTABLE_API_KEY;

async function airtableGet(id) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  return r.json();
}
async function airtablePatch(id, fields) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method not allowed" });
    return;
  }
  const { record_id, approve, draft } = req.body || {};
  if (!record_id) {
    res.status(400).json({ ok: false, error: "missing record_id" });
    return;
  }
  if (approve !== true && approve !== "true") {
    res.status(403).json({ ok: false, error: "REFUSED — explicit approval required to send" });
    return;
  }
  try {
    const j = await airtableGet(record_id);
    const f = j.fields || {};
    const notes = f["Notes"] || "";
    const m = notes.match(/APPLY_EMAIL:\s*([^\s\n]+)/i);
    if (!m) {
      res.status(400).json({ ok: false, error: "No APPLY_EMAIL in row Notes" });
      return;
    }
    const to = m[1];
    const atts = f["Attachments"] || [];
    const pdf = atts.find((a) => /\.pdf$/i.test(a.filename || ""));
    const company = f["Company Name"] || "";
    const title = f["Job Title"] || "";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });

    const mail = {
      from: `Raphael Merchant <${process.env.GMAIL_USER}>`,
      to,
      replyTo: process.env.GMAIL_USER,
      subject: `Application — ${title}, ${company}`,
      text: draft || `Hi ${company} team,\n\nPlease find my application for the ${title} role attached.\n\nBest,\nRaphael Merchant`,
      attachments: [],
    };
    if (pdf) {
      const buf = await (await fetch(pdf.url)).arrayBuffer();
      mail.attachments.push({ filename: pdf.filename, content: Buffer.from(buf) });
    }

    await transporter.sendMail(mail);
    const today = new Date().toISOString().slice(0, 10);
    await airtablePatch(record_id, {
      Status: "Applied",
      "Application Date": today,
      Notes: `${notes}\n[email-sent ${today}] application emailed to ${to}`.trim(),
    });
    res.status(200).json({ ok: true, sent_to: to, attached: pdf ? pdf.filename : null, status: "Applied" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
