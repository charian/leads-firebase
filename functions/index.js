// functions/index.js
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// 리전 고정
setGlobalOptions({ region: "asia-northeast3" });

// Admin SDK 초기화 (프로젝트 기본 앱)
admin.initializeApp();

// ===== 공용 설정 =====
const DB_NAME = "customer-database"; // 보조 DB명
const LEADS = "leads";

// (선택) 랜딩 도메인 CORS 화이트리스트 — createLead(http)에서만 사용
const ALLOWED_ORIGINS = [
  // 예: 'https://planplant.co.kr',
];

// 한국 번호 간이 정규화 → E.164(+82…)
function normalizePhoneKR(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("82")) digits = "82" + digits;
  return "+" + digits;
}

// 지역값 정규화
function normalizeRegion(input) {
  const v = String(input || "").trim();
  if (v === "수도권" || v.toLowerCase() === "metro") return { ko: "수도권", key: "metro" };
  if (v === "비수도권" || ["non_metro", "non-metro"].includes(v.toLowerCase()))
    return { ko: "비수도권", key: "non_metro" };
  return null;
}

// 특정 Firestore 데이터베이스 핸들
const db = getFirestore(undefined, DB_NAME);

// CORS helper (createLead용)
function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = ALLOWED_ORIGINS.includes(origin);
  if (allowed) res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  return allowed;
}

/**
 * ping: 헬스체크용
 */
exports.ping = onRequest((req, res) => res.status(200).send("pong"));

/**
 * createLead: 랜딩에서 호출하는 HTTP 엔드포인트
 *  - CORS 허용 도메인에서만 동작
 *  - leads/{phone_e164} 문서로 저장 (중복 phone 차단)
 */
exports.createLead = onRequest(async (req, res) => {
  const allowed = setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (!allowed) return res.status(403).json({ error: "Forbidden origin" });

  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const {
      name,
      phone,
      region,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      page,
      userAgent,
    } = req.body || {};

    if (!name || !phone || !region) {
      return res.status(400).json({ error: "name, phone, region are required" });
    }

    const regionInfo = normalizeRegion(region);
    if (!regionInfo) return res.status(400).json({ error: "region must be 수도권 or 비수도권" });

    const phoneE164 = normalizePhoneKR(phone);
    if (!/^\+\d{9,15}$/.test(phoneE164)) {
      return res.status(400).json({ error: "invalid phone" });
    }

    const docRef = db.collection(LEADS).doc(phoneE164);

    // 중복 체크
    if ((await docRef.get()).exists) {
      return res.status(409).json({ error: "duplicate phone", phone: phoneE164 });
    }

    await docRef.set(
      {
        name: String(name).trim(),
        phone_raw: String(phone).trim(),
        phone_e164: phoneE164,
        region_key: regionInfo.key, // 'metro' | 'non_metro'
        region_ko: regionInfo.ko,   // '수도권' | '비수도권'
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
      },
      { merge: false }
    );

    return res.status(201).json({ ok: true, id: phoneE164 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal", detail: err.message });
  }
});

/**
 * incrementDownloads: (되돌림) Firebase Callable Function
 *  - 클라이언트에서 httpsCallable로 호출
 *  - Firebase Auth 로그인 필수
 *  - leads/{id}.download 를 +1 (여러 개 배치 처리)
 *  - Admin SDK이므로 Firestore 보안규칙의 영향 없음
 */
exports.incrementDownloads = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    // functions/unauthenticated 에러 코드를 내보내려면 throw new HttpsError 사용 가능
    const { HttpsError } = require("firebase-functions/v2/https");
    throw new HttpsError("unauthenticated", "signin required");
  }

  const ids = req.data?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    const { HttpsError } = require("firebase-functions/v2/https");
    throw new HttpsError("invalid-argument", "ids required");
  }

  // 같은 보조 DB 사용
  const _db = getFirestore(undefined, DB_NAME);

  const writer = _db.bulkWriter();
  for (const id of ids) {
    const ref = _db.collection(LEADS).doc(id);
    writer.update(ref, { download: FieldValue.increment(1) });
  }
  await writer.close();

  return { updated: ids.length };
});
