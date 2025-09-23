// ✨ 수정: onCall과 onSchedule을 각각 올바른 모듈에서 가져옵니다.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { formatInTimeZone } = require("date-fns-tz");

setGlobalOptions({ region: "asia-northeast3" });
admin.initializeApp();

const db = getFirestore("customer-database");
const LEADS = "leads";

// --- Helper Functions ---
const getAdminRoles = async () => {
  const adminDoc = await db.collection("_config").doc("admins").get();
  if (!adminDoc.exists) {
    console.error("CRITICAL: '_config/admins' document not found!");
    return {};
  }
  return adminDoc.data().roles || {};
};

const ensureIsRole = async (context, allowedRoles) => {
  const email = context.auth?.token?.email;
  if (!email) throw new HttpsError("unauthenticated", "Authentication required.");
  const roles = await getAdminRoles();
  const userRole = roles[email];
  if (!allowedRoles.includes(userRole)) {
    throw new HttpsError("permission-denied", `Permission denied. Required one of: ${allowedRoles.join(", ")}`);
  }
  return { email, role: userRole };
};

function formatPhoneNumber(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return phone;
}

// --- Callable Functions ---

exports.getMyRole = onCall({ invoker: 'public' }, async (req) => {
  const email = req.auth?.token?.email;
  if (!email) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const roles = await getAdminRoles();
  const role = roles[email] || null;
  return { email, role };
});

exports.getAdmins = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  const roles = await getAdminRoles();
  return Object.entries(roles).map(([email, role]) => ({ email, role }));
});

exports.addAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !['admin', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'A valid email and role are required.');
  }
  await db.collection('_config').doc('admins').set({ roles: { [email]: role } }, { merge: true });
  return { ok: true };
});

exports.updateAdminRole = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !['admin', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'A valid email and role are required.');
  }
  await db.collection('_config').doc('admins').update({ [`roles.${email}`]: role });
  return { ok: true };
});

exports.removeAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email } = req.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email is required.');
  await db.collection('_config').doc('admins').update({ [`roles.${email}`]: FieldValue.delete() });
  return { ok: true };
});

exports.createLeadCall = onCall({ invoker: "public" }, async (req) => {
  const { name, phone, region, ...restData } = req.data || {};
  if (!name || !phone || !region) throw new HttpsError("invalid-argument", "name, phone, region are required.");

  const phoneDigits = String(phone).replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) throw new HttpsError("invalid-argument", "Invalid phone number format.");
  const phoneE164 = "+82" + phoneDigits.substring(1);

  const snapshot = await db.collection(LEADS).where("phone_e164", "==", phoneE164).limit(1).get();
  if (!snapshot.empty) throw new HttpsError("already-exists", "This phone number is already registered.");

  const newLeadRef = db.collection(LEADS).doc();
  const newLead = {
    id: newLeadRef.id,
    name: String(name).trim(),
    phone_raw: formatPhoneNumber(phone),
    phone_e164: phoneE164,
    region_ko: region,
    ...restData,
    createdAt: FieldValue.serverTimestamp(),
    download: 0,
    isBad: false,
    memo: "",
  };

  await db.collection("mail").add({
    to: ['angdry@planplant.io'],
    message: {
      subject: `[기획공장] 신규 리드가 등록되었습니다: ${name}`,
      html: `<h3>신규 리드 정보</h3><p><strong>이름:</strong> ${newLead.name}</p><p><strong>연락처:</strong> ${newLead.phone_raw}</p><p><strong>지역:</strong> ${newLead.region_ko}</p><p><strong>UTM 소스:</strong> ${newLead.utm_source || 'N/A'}</p>`,
    },
  });

  await newLeadRef.set(newLead);
  return { ok: true, id: newLeadRef.id };
});

exports.deleteLeads = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { ids } = req.data;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "ids must be a non-empty array.");
  const batch = db.batch();
  ids.forEach(id => batch.delete(db.collection(LEADS).doc(id)));
  await batch.commit();
  return { deleted: ids.length };
});

exports.incrementDownloads = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { ids } = req.data;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "ids must be a non-empty array.");

  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  ids.forEach(id => {
    const docRef = db.collection(LEADS).doc(id);
    batch.update(docRef, {
      download: FieldValue.increment(1),
      downloadedAt: now,
      downloadedBy: email,
    });
  });

  await batch.commit();
  return { updated: ids.length };
});

exports.sendDailySummary = onSchedule({ schedule: "every day 05:00", timeZone: "Asia/Seoul" }, async () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

  const snapshot = await db.collection(LEADS).where("createdAt", ">=", startOfYesterday).where("createdAt", "<=", endOfYesterday).get();
  const leads = snapshot.docs.map(doc => doc.data());
  const totalLeads = leads.length;

  if (totalLeads === 0) {
    console.log("No new leads yesterday. Skipping summary email.");
    return null;
  }

  const summaryDate = formatInTimeZone(startOfYesterday, "Asia/Seoul", 'yyyy년 MM월 dd일');
  const leadsHtml = leads.map(lead => `<li>${lead.name} (${lead.phone_raw}) - ${lead.region_ko}</li>`).join('');

  await db.collection("mail").add({
    to: ['angdry@planplant.io'],
    message: {
      subject: `[기획공장] ${summaryDate} 리드 요약 (${totalLeads}건)`,
      html: `<h3>${summaryDate} 신규 리드 요약</h3><p>총 <strong>${totalLeads}</strong>건의 신규 리드가 등록되었습니다.</p><ul>${leadsHtml}</ul>`,
    },
  });

  console.log(`Sent daily summary for ${totalLeads} leads.`);
  return null;
});

