const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

setGlobalOptions({ region: "asia-northeast3" });
admin.initializeApp();

const db = getFirestore("customer-database");
const LEADS = "leads";
const SUPER_ADMIN_EMAIL = "angdry@planplant.io";

// --- Helper Functions for Permissions ---

// Firestore에서 운영자 역할(role) 목록을 가져옵니다.
const getAdminRoles = async () => {
  const adminDoc = await db.collection("_config").doc("admins").get();
  if (!adminDoc.exists) {
    console.error("CRITICAL: '_config/admins' document not found!");
    return {};
  }
  return adminDoc.data().roles || {};
};

// 요청한 사용자가 운영자인지 (슈퍼어드민 포함) 확인합니다.
const ensureIsAdmin = async (context) => {
  const email = context.auth?.token?.email;
  if (!email) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  if (email === SUPER_ADMIN_EMAIL) return email; // 슈퍼어드민은 항상 통과

  const adminRoles = await getAdminRoles();
  if (adminRoles[email] !== 'admin') {
    throw new HttpsError("permission-denied", "Admin permission required.");
  }
  return email;
};

// 요청한 사용자가 슈퍼어드민인지 확인합니다.
const ensureIsSuperAdmin = (context) => {
  const email = context.auth?.token?.email;
  if (email !== SUPER_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Super admin permission required.");
  }
  return email;
}

// --- Utility Functions ---

function formatPhoneNumber(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return raw;
}
function normalizePhoneKR(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("82")) digits = "82" + digits;
  return "+" + digits;
}
function normalizeRegion(input) {
  const v = String(input || "").trim();
  if (v === "수도권" || v.toLowerCase() === "metro") return { ko: "수도권", key: "metro" };
  if (v === "비수도권" || ["non_metro", "non-metro"].includes(v.toLowerCase())) return { ko: "비수도권", key: "non_metro" };
  return null;
}

// --- Callable Functions ---

// 웹사이트에서 새로운 리드를 생성합니다.
exports.createLeadCall = onCall({ invoker: 'public' }, async (req) => {
  const { name, phone, region, ...rest } = req.data || {};
  if (!name || !phone || !region) throw new HttpsError("invalid-argument", "name, phone, region are required");

  const regionInfo = normalizeRegion(region);
  if (!regionInfo) throw new HttpsError("invalid-argument", "region must be 수도권 or 비수도권");

  const phoneE164 = normalizePhoneKR(phone);
  if (!/^\+82\d{9,10}$/.test(phoneE164)) throw new HttpsError("invalid-argument", "invalid phone");

  const newLeadRef = db.collection(LEADS).doc();
  await newLeadRef.set({
    id: newLeadRef.id,
    name: String(name).trim(),
    phone_raw: formatPhoneNumber(phone),
    phone_e164: phoneE164,
    region_key: regionInfo.key,
    region_ko: regionInfo.ko,
    referrer: rest.referrer || "",
    utm_source: rest.utm_source || "",
    utm_medium: rest.utm_medium || "",
    utm_campaign: rest.utm_campaign || "",
    utm_content: rest.utm_content || "",
    utm_term: rest.utm_term || "",
    page: rest.page || "",
    userAgent: rest.userAgent || "",
    createdAt: FieldValue.serverTimestamp(),
    download: 0,
    memo: "",
  });
  return { ok: true, id: newLeadRef.id };
});

// 선택된 리드의 다운로드 카운트를 1 증가시킵니다.
exports.incrementDownloads = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsAdmin(req);
  const ids = req.data?.ids;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "ids required");

  const writer = db.bulkWriter();
  for (const id of ids) {
    writer.update(db.collection(LEADS).doc(String(id)), { download: FieldValue.increment(1) });
  }
  await writer.close();
  return { updated: ids.length };
});

// 선택된 리드를 삭제합니다.
exports.deleteLeads = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsAdmin(req);
  const ids = req.data?.ids;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "ids are required.");

  const writer = db.bulkWriter();
  ids.forEach(id => writer.delete(db.collection(LEADS).doc(id)));
  await writer.close();
  return { ok: true, deletedCount: ids.length };
});

// 모든 운영자 목록을 가져옵니다.
exports.getAdmins = onCall({ invoker: 'public' }, async (req) => {
  try {
    await ensureIsAdmin(req);
    const roles = await getAdminRoles();

    const superAdmin = { email: SUPER_ADMIN_EMAIL, role: 'super-admin' };
    const otherAdmins = Object.entries(roles).map(([email, role]) => ({ email: String(email), role: String(role) }));

    const adminList = [superAdmin, ...otherAdmins];

    // 디버깅용 로그: 반환되는 데이터 구조를 확인합니다.
    console.log("Returning admin list:", JSON.stringify(adminList));

    return adminList;
  } catch (error) {
    // 디버깅용 로그: 에러 발생 시 기록합니다.
    console.error("Error in getAdmins function:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while fetching admins.");
  }
});

// 새로운 운영자를 추가합니다 (슈퍼어드민 전용).
exports.addAdmin = onCall({ invoker: 'public' }, async (req) => {
  ensureIsSuperAdmin(req);
  const newEmail = req.data?.email;
  if (!newEmail || !newEmail.includes('@')) throw new HttpsError("invalid-argument", "Valid email is required.");
  if (newEmail === SUPER_ADMIN_EMAIL) throw new HttpsError("already-exists", "Cannot manage super admin.");

  const adminRef = db.collection("_config").doc("admins");
  await adminRef.set({ roles: { [newEmail]: 'admin' } }, { merge: true });
  return { ok: true };
});

// 운영자를 삭제합니다 (슈퍼어드민 전용).
exports.removeAdmin = onCall({ invoker: 'public' }, async (req) => {
  ensureIsSuperAdmin(req);
  const emailToRemove = req.data?.email;
  if (!emailToRemove) throw new HttpsError("invalid-argument", "Email is required.");
  if (emailToRemove === SUPER_ADMIN_EMAIL) throw new HttpsError("permission-denied", "Cannot manage super admin.");

  const adminRef = db.collection("_config").doc("admins");
  await adminRef.update({ [`roles.${emailToRemove}`]: FieldValue.delete() });
  return { ok: true };
});