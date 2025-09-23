// functions/index.js
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

setGlobalOptions({ region: "asia-northeast3" });
admin.initializeApp();

const DB_NAME = "customer-database";
const LEADS = "leads";

const ALLOWED_ORIGINS = new Set([
  "https://planplant-database.web.app",
  "http://localhost:5173",
  "https://planplant.io",
  "https://urology01.planplant.io",
]);

function normalizePhoneKR(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("82")) digits = "82" + digits;
  return "+" + digits;
}

function normalizeRegion(v) {
  const s = String(v || "").trim();
  if (s === "수도권" || s.toLowerCase() === "metro") return { ko: "수도권", key: "metro" };
  if (s === "비수도권" || ["non_metro", "non-metro"].includes(s.toLowerCase())) return { ko: "비수도권", key: "non_metro" };
  return null;
}

const db = getFirestore(undefined, DB_NAME);

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.has(origin);
  if (allow) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return allow;
}

exports.ping = onRequest((req, res) => res.status(200).send("pong"));

exports.createLead = onRequest(async (req, res) => {
  const allowed = setCors(req, res);

  // ✅ preflight를 안 쓸 거지만, 혹시 올 수도 있으니 그대로 처리
  if (req.method === "OPTIONS") return res.status(204).send("");

  if (!allowed) return res.status(403).json({ error: "Forbidden origin" });

  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    // ✅ body 파싱: JSON, 또는 text/plain(JSON string)
    let body = req.body;
    if (!body || typeof body !== "object") {
      // application/json이 아니거나, 파싱이 안 된 경우
      try {
        const raw = req.rawBody?.toString() || "";
        if (raw) body = JSON.parse(raw);
      } catch (e) {
        return res.status(400).json({ error: "invalid-body" });
      }
    }

    const {
      name,
      phone,       // 원본 전화
      region,      // "수도권" | "비수도권"
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      page,
      userAgent,
    } = body || {};

    // 필수값
    if (!name || !phone || !region) {
      return res.status(400).json({ error: "name, phone, region are required" });
    }

    const regionInfo = normalizeRegion(region);
    if (!regionInfo) return res.status(400).json({ error: "region must be 수도권 or 비수도권" });

    const phoneE164 = normalizePhoneKR(phone);
    if (!/^\+\d{9,15}$/.test(phoneE164)) return res.status(400).json({ error: "invalid phone" });

    const docRef = db.collection(LEADS).doc(phoneE164);

    const existing = await docRef.get();
    if (existing.exists) return res.status(409).json({ error: "duplicate phone", phone: phoneE164 });

    await docRef.set({
      name: String(name).trim(),
      phone_raw: String(phone).trim(),
      phone_e164: phoneE164,
      region_key: regionInfo.key,
      region_ko: regionInfo.ko,
      referrer: referrer || req.headers["referer"] || "",
      utm_source: utm_source || "",
      utm_medium: utm_medium || "",
      utm_campaign: utm_campaign || "",
      utm_content: utm_content || "",
      utm_term: utm_term || "",
      page: page || "",
      userAgent: userAgent || req.headers["user-agent"] || "",
      createdAt: FieldValue.serverTimestamp(),
      download: 0,
    });

    return res.status(201).json({ ok: true, id: phoneE164 });
  } catch (err) {
    console.error("[createLead] error:", err);
    return res.status(500).json({ error: "internal", detail: err.message });
  }
});

exports.incrementDownloads = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "signin required");

  const ids = req.data?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new HttpsError("invalid-argument", "ids required");
  }

  const writer = db.bulkWriter();
  for (const id of ids) {
    writer.update(db.collection(LEADS).doc(id), { download: FieldValue.increment(1) });
  }
  await writer.close();
  return { updated: ids.length };
});
