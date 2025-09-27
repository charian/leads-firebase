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
const HISTORY = "history";

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
  const normalizedEmail = email.trim().toLowerCase();
  let userRole = null;

  for (const key in roles) {
    if (key.trim().toLowerCase() === normalizedEmail) {
      userRole = roles[key];
      break;
    }
  }

  if (!allowedRoles.includes(userRole)) {
    throw new HttpsError("permission-denied", `Permission denied. Your role is '${userRole}'. Required one of: ${allowedRoles.join(", ")}`);
  }
  return { email, role: userRole };
};

// ... (logHistory, formatPhoneNumber functions are unchanged) ...
const logHistory = async (action, userEmail, leadIds, details = {}) => {
  const batch = db.batch();
  const timestamp = FieldValue.serverTimestamp();
  const leadIdsArray = Array.isArray(leadIds) ? leadIds : [leadIds];
  leadIdsArray.forEach(leadId => {
    const historyRef = db.collection(HISTORY).doc();
    batch.set(historyRef, { action, userEmail, leadId, timestamp, ...details });
  });
  await batch.commit();
};
function formatPhoneNumber(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return phone;
}


// --- Callable Functions ---

// ✨✨✨ 추가: "닭이 먼저냐 달걀이 먼저냐" 문제를 해결하기 위한 전용 함수 ✨✨✨
// 이 함수는 권한 검사 없이 로그인한 사용자의 역할만 안전하게 반환합니다.
exports.getMyRole = onCall({ invoker: 'public' }, async (req) => {
  const email = req.auth?.token?.email;
  if (!email) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const roles = await getAdminRoles();
  const normalizedEmail = email.trim().toLowerCase();
  let role = null;
  for (const key in roles) {
    if (key.trim().toLowerCase() === normalizedEmail) {
      role = roles[key];
      break;
    }
  }
  return { email, role };
});


exports.getAdmins = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);

  const roles = await getAdminRoles();
  const listUsersResult = await admin.auth().listUsers(1000);
  const authUserMap = new Map();
  listUsersResult.users.forEach(user => {
    if (user.email) {
      authUserMap.set(user.email.trim().toLowerCase(), {
        lastSignInTime: user.metadata.lastSignInTime,
      });
    }
  });

  const combinedAdmins = Object.entries(roles).map(([email, role]) => {
    const normalizedEmail = email.trim().toLowerCase();
    const authData = authUserMap.get(normalizedEmail);
    return {
      email,
      role,
      lastSignInTime: authData ? authData.lastSignInTime : null
    };
  });

  return combinedAdmins;
});


// (addAdmin, updateAdminRole, removeAdmin functions are unchanged, but now use FieldPath for safety)
exports.addAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !['admin', 'user'].includes(role)) throw new HttpsError('invalid-argument', 'A valid email and role are required.');
  const docRef = db.collection('_config').doc('admins');
  const fieldPath = new admin.firestore.FieldPath('roles', email);
  await docRef.update({ [fieldPath]: role });
  return { ok: true };
});

exports.updateAdminRole = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !['admin', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'A valid email and role are required.');
  }
  const docRef = db.collection('_config').doc('admins');
  const fieldPath = new admin.firestore.FieldPath('roles', email);
  await docRef.update({ [fieldPath]: role });
  return { ok: true };
});

exports.removeAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email } = req.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email is required.');
  const docRef = db.collection('_config').doc('admins');
  const fieldPath = new admin.firestore.FieldPath('roles', email);
  await docRef.update({ [fieldPath]: FieldValue.delete() });
  return { ok: true };
});

// ... (Other functions remain unchanged) ...
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
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { ids } = req.data;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "ids must be a non-empty array.");
  await logHistory('DELETE', email, ids);
  const batch = db.batch();
  ids.forEach(id => batch.delete(db.collection(LEADS).doc(id)));
  await batch.commit();
  return { deleted: ids.length };
});
exports.incrementDownloads = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { ids } = req.data;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "ids must be a non-empty array.");
  await logHistory('DOWNLOAD', email, ids);
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
exports.updateMemoAndLog = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { leadId, memo, oldMemo } = req.data;
  if (!leadId) throw new HttpsError('invalid-argument', 'leadId is required.');
  await logHistory('UPDATE_MEMO', email, leadId, { from: oldMemo, to: memo });
  await db.collection(LEADS).doc(leadId).update({ memo });
  return { ok: true };
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
  if (totalLeads === 0) return null;
  const summaryDate = formatInTimeZone(startOfYesterday, "Asia/Seoul", 'yyyy년 MM월 dd일');
  const leadsHtml = leads.map(lead => `<li>${lead.name} (${lead.phone_raw}) - ${lead.region_ko}</li>`).join('');
  await db.collection("mail").add({
    to: ['angdry@planplant.io'],
    message: {
      subject: `[기획공장] ${summaryDate} 리드 요약 (${totalLeads}건)`,
      html: `<h3>${summaryDate} 신규 리드 요약</h3><p>총 <strong>${totalLeads}</strong>건의 신규 리드가 등록되었습니다.</p><ul>${leadsHtml}</ul>`,
    },
  });
  return null;
});
exports.getSettlementConfig = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  const doc = await db.collection('_config').doc('settlement').get();
  if (!doc.exists) return { costs: {} };
  return doc.data();
});
exports.setSettlementCost = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { year, cost } = req.data;
  if (!year || !cost) throw new HttpsError('invalid-argument', 'year and cost are required.');
  await db.collection('_config').doc('settlement').set({ costs: { [year]: Number(cost) } }, { merge: true });
  return { ok: true };
});
exports.calculateSettlement = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  const { startDate, endDate } = req.data;
  if (!startDate || !endDate) throw new HttpsError('invalid-argument', 'startDate and endDate are required.');
  const start = new Date(startDate);
  const end = new Date(endDate);
  const leadsSnap = await db.collection(LEADS).where('downloadedAt', '>=', start).where('downloadedAt', '<=', end).get();
  const leads = leadsSnap.docs.map(d => d.data());
  const settlementDoc = await db.collection('_config').doc('settlement').get();
  const costs = settlementDoc.exists ? settlementDoc.data().costs : {};
  const dailyData = {};
  leads.forEach(lead => {
    const dateStr = formatInTimeZone(lead.downloadedAt.toDate(), 'Asia/Seoul', 'yyyy-MM-dd');
    if (!dailyData[dateStr]) {
      dailyData[dateStr] = { downloads: 0, bads: 0, date: dateStr };
    }
    dailyData[dateStr].downloads += 1;
    if (lead.isBad) {
      dailyData[dateStr].bads += 1;
    }
  });
  const year = start.getFullYear().toString();
  const costPerLead = costs[year] || 0;
  return { dailyData: Object.values(dailyData), costPerLead };
});
exports.getHistory = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { limit = 50 } = req.data;
  const snapshot = await db.collection(HISTORY).orderBy('timestamp', 'desc').limit(limit).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});

