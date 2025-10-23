const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { formatInTimeZone } = require("date-fns-tz");
const { subDays, startOfWeek, startOfMonth } = require("date-fns");
const { BigQuery } = require("@google-cloud/bigquery");
const geoip = require("geoip-lite");

// 초기화
setGlobalOptions({ region: "asia-northeast3", memory: "256MiB" });
admin.initializeApp();
const db = getFirestore("customer-database");
const bigquery = new BigQuery();

// 상수
const LEADS_COLLECTION = "leads";
const HISTORY_COLLECTION = "history";
const AD_COSTS_COLLECTION = "ad_costs";
const CONFIG_COLLECTION = "_config";
const ADMINS_DOC = "admins";
const SETTLEMENT_DOC = "settlement";
const API_CREDENTIALS_DOC = "api_credentials";
const MAIL_COLLECTION = "mail";

// 헬퍼 함수
const getAdminConfig = async () => {
  try {
    const adminDoc = await db.collection(CONFIG_COLLECTION).doc(ADMINS_DOC).get();
    if (!adminDoc.exists()) {
      console.warn(`'${CONFIG_COLLECTION}/${ADMINS_DOC}' document not found!`);
      return { roles: {}, notifications: {} };
    }
    return adminDoc.data() || { roles: {}, notifications: {} };
  } catch (error) {
    console.error("Error fetching admin config:", error);
    throw new HttpsError("internal", "관리자 설정 정보를 가져오는 중 오류가 발생했습니다.");
  }
};

const ensureIsRole = async (req, allowedRoles) => {
  const email = req.auth?.token?.email;
  if (!email) throw new HttpsError("unauthenticated", "인증이 필요합니다.");
  const { roles } = await getAdminConfig();
  const normalizedEmail = email.trim().toLowerCase();
  let userRole = null;
  for (const key in roles) {
    if (key.trim().toLowerCase() === normalizedEmail) {
      userRole = roles[key];
      break;
    }
  }
  if (!userRole || !allowedRoles.includes(userRole)) {
    console.warn(`Permission denied for ${email}. Required role: ${allowedRoles.join(", ")}, but has role: ${userRole}`);
    throw new HttpsError("permission-denied", "이 작업을 수행할 권한이 없습니다.");
  }
  return { email, role: userRole };
};

const logHistory = async (action, userEmail, leadIds, details = {}) => {
  try {
    const leadIdsArray = Array.isArray(leadIds) ? leadIds : [leadIds];
    if (leadIdsArray.length === 0) return;
    const leadsRef = db.collection(LEADS_COLLECTION);
    const leadDocs = await leadsRef.where(admin.firestore.FieldPath.documentId(), 'in', leadIdsArray).get();
    const leadsMap = new Map();
    leadDocs.forEach(doc => leadsMap.set(doc.id, doc.data()));
    const batch = db.batch();
    const timestamp = FieldValue.serverTimestamp();
    leadIdsArray.forEach(leadId => {
      const historyRef = db.collection(HISTORY_COLLECTION).doc();
      const leadData = leadsMap.get(leadId);
      const logEntry = { action, userEmail, leadId, timestamp, leadName: leadData?.name || '', leadPhone: leadData?.phone_raw || '', ...details };
      batch.set(historyRef, logEntry);
    });
    await batch.commit();
  } catch (error) {
    console.error(`Failed to log history for action ${action}:`, error);
  }
};

function formatPhoneNumber(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  return phone;
}

// Callable Functions
exports.getMyRole = onCall({ invoker: 'public' }, async (req) => {
  const email = req.auth?.token?.email;
  if (!email) return { email: null, role: null };
  try {
    const { roles } = await getAdminConfig();
    const normalizedEmail = email.trim().toLowerCase();
    let role = null;
    for (const key in roles) {
      if (key.trim().toLowerCase() === normalizedEmail) {
        role = roles[key];
        break;
      }
    }
    return { email, role };
  } catch (error) {
    console.error("Error in getMyRole:", error);
    throw new HttpsError("internal", "역할 정보를 가져오는 중 오류가 발생했습니다.");
  }
});

exports.getAdmins = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  try {
    const { roles, notifications } = await getAdminConfig();
    const listUsersResult = await admin.auth().listUsers(1000);
    const authUserMap = new Map();
    listUsersResult.users.forEach(user => {
      if (user.email) authUserMap.set(user.email.trim().toLowerCase(), { lastSignInTime: user.metadata.lastSignInTime });
    });
    return Object.entries(roles).map(([email, role]) => {
      const authData = authUserMap.get(email.trim().toLowerCase());
      const notificationPrefs = notifications?.[email.replace(/\./g, "_")] || {};
      return { email, role, lastSignInTime: authData?.lastSignInTime || null, notifyOnNewLead: notificationPrefs.notifyOnNewLead !== false, notifyOnDailySummary: notificationPrefs.notifyOnDailySummary !== false };
    });
  } catch (error) {
    console.error("Error in getAdmins:", error);
    throw new HttpsError("internal", "관리자 목록을 불러오는 데 실패했습니다.");
  }
});

exports.addAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['admin', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', '올바른 이메일과 역할(admin, user)을 입력해주세요.');
  }
  try {
    const docRef = db.collection(CONFIG_COLLECTION).doc(ADMINS_DOC);
    await docRef.set({ roles: { [email]: role }, notifications: { [email.replace(/\./g, "_")]: { notifyOnNewLead: true, notifyOnDailySummary: true } } }, { merge: true });
    return { ok: true };
  } catch (error) {
    console.error("Error in addAdmin:", error);
    throw new HttpsError("internal", "관리자 추가에 실패했습니다.");
  }
});

exports.updateAdminRole = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !['admin', 'user', 'super-admin'].includes(role)) throw new HttpsError('invalid-argument', '올바른 이메일과 역할을 입력해주세요.');
  try {
    const docRef = db.collection(CONFIG_COLLECTION).doc(ADMINS_DOC);
    await docRef.update(new admin.firestore.FieldPath('roles', email), role);
    return { ok: true };
  } catch (error) {
    console.error("Error in updateAdminRole:", error);
    throw new HttpsError("internal", "역할 변경에 실패했습니다.");
  }
});

exports.updateAdminNotifications = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, field, value } = req.data;
  if (!email || !['notifyOnNewLead', 'notifyOnDailySummary'].includes(field) || typeof value !== 'boolean') throw new HttpsError('invalid-argument', '올바른 이메일, 필드, 값을 입력해주세요.');
  try {
    const docRef = db.collection(CONFIG_COLLECTION).doc(ADMINS_DOC);
    const updatePath = new admin.firestore.FieldPath('notifications', email.replace(/\./g, "_"), field);
    await docRef.update(updatePath, value);
    return { ok: true };
  } catch (error) {
    console.error("Error in updateAdminNotifications:", error);
    throw new HttpsError("internal", "알림 설정 변경에 실패했습니다.");
  }
});

exports.removeAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email } = req.data;
  if (!email) throw new HttpsError('invalid-argument', '이메일이 필요합니다.');
  try {
    const docRef = db.collection(CONFIG_COLLECTION).doc(ADMINS_DOC);
    await docRef.update({
      [new admin.firestore.FieldPath('roles', email)]: FieldValue.delete(),
      [new admin.firestore.FieldPath('notifications', email.replace(/\./g, "_"))]: FieldValue.delete(),
    });
    return { ok: true };
  } catch (error) {
    console.error("Error in removeAdmin:", error);
    throw new HttpsError("internal", "관리자 삭제에 실패했습니다.");
  }
});

exports.createLeadCall = onCall({ invoker: "public" }, async (req) => {
  const { name, phone, region, referrer, ...restData } = req.data || {};
  if (!name || !phone || !region) throw new HttpsError("invalid-argument", "이름, 전화번호, 지역은 필수 항목입니다.");
  const phoneDigits = String(phone).replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) throw new HttpsError("invalid-argument", "올바르지 않은 전화번호 형식입니다.");
  try {
    const phoneE164 = "+82" + phoneDigits.substring(1);
    const snapshot = await db.collection(LEADS_COLLECTION).where("phone_e164", "==", phoneE164).limit(1).get();
    if (!snapshot.empty) throw new HttpsError("already-exists", "이미 등록된 전화번호입니다.");
    const ip = req.ip || req.rawRequest.headers['x-forwarded-for'] || req.rawRequest.connection?.remoteAddress;
    const geo = ip ? geoip.lookup(ip.split(',')[0]) : null;
    const newLeadRef = db.collection(LEADS_COLLECTION).doc();
    const newLead = { id: newLeadRef.id, name: String(name).trim(), phone_raw: formatPhoneNumber(phone), phone_e164, region_ko: region, referrer: referrer || "", ...restData, createdAt: FieldValue.serverTimestamp(), ipAddress: ip || null, ipCity: geo ? `${geo.country}, ${geo.city}` : 'Unknown', download: 0, isBad: false, memo: "", visited: false, procedure: false };
    await newLeadRef.set(newLead);
    const { roles, notifications } = await getAdminConfig();
    const recipients = Object.keys(roles).filter(email => notifications?.[email.replace(/\./g, "_")]?.notifyOnNewLead !== false);
    if (recipients.length > 0) {
      await db.collection(MAIL_COLLECTION).add({ to: recipients, from: 'contact@planplant.io', template: { name: 'new-lead-alert', data: { name: newLead.name, phone: newLead.phone_raw, region: newLead.region_ko, referrer: newLead.referrer || '직접 유입' } } });
    }
    return { ok: true, id: newLeadRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error in createLeadCall:", error);
    throw new HttpsError("internal", "리드 생성 중 오류가 발생했습니다.");
  }
});

exports.deleteLeads = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { ids } = req.data;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "삭제할 리드의 ID 배열이 필요합니다.");
  try {
    await logHistory('DELETE', email, ids);
    const batch = db.batch();
    ids.forEach(id => batch.delete(db.collection(LEADS_COLLECTION).doc(id)));
    await batch.commit();
    return { deleted: ids.length };
  } catch (error) {
    console.error("Error in deleteLeads:", error);
    throw new HttpsError("internal", "리드 삭제 중 오류가 발생했습니다.");
  }
});

exports.incrementDownloads = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { ids } = req.data;
  if (!Array.isArray(ids) || ids.length === 0) throw new HttpsError("invalid-argument", "다운로드할 리드의 ID 배열이 필요합니다.");
  try {
    await logHistory('DOWNLOAD', email, ids);
    const batch = db.batch();
    ids.forEach(id => {
      const docRef = db.collection(LEADS_COLLECTION).doc(id);
      batch.update(docRef, { download: FieldValue.increment(1), downloadedAt: FieldValue.serverTimestamp(), downloadedBy: email });
    });
    await batch.commit();
    return { updated: ids.length };
  } catch (error) {
    console.error("Error in incrementDownloads:", error);
    throw new HttpsError("internal", "다운로드 횟수 업데이트 중 오류가 발생했습니다.");
  }
});

exports.updateMemoAndLog = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { leadId, memo, oldMemo } = req.data;
  if (!leadId) throw new HttpsError('invalid-argument', '리드 ID가 필요합니다.');
  try {
    await logHistory('UPDATE_MEMO', email, leadId, { from: oldMemo, to: memo });
    await db.collection(LEADS_COLLECTION).doc(leadId).update({ memo });
    return { ok: true };
  } catch (error) {
    console.error("Error in updateMemoAndLog:", error);
    throw new HttpsError("internal", "메모 업데이트 중 오류가 발생했습니다.");
  }
});

exports.setLeadStatus = onCall({ invoker: 'public' }, async (req) => {
  const { email } = await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { leadId, field, status } = req.data;
  const allowedFields = ['isBad', 'visited', 'procedure'];
  if (!leadId || !allowedFields.includes(field) || typeof status !== 'boolean') throw new HttpsError('invalid-argument', '올바른 리드 ID, 필드, 상태값이 필요합니다.');
  try {
    await logHistory(`SET_${field.toUpperCase()}`, email, leadId, { status });
    await db.collection(LEADS_COLLECTION).doc(leadId).update({ [field]: status });
    return { ok: true };
  } catch (error) {
    console.error("Error in setLeadStatus:", error);
    throw new HttpsError("internal", "리드 상태 변경 중 오류가 발생했습니다.");
  }
});

exports.getSettlementConfig = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  try {
    const doc = await db.collection(CONFIG_COLLECTION).doc(SETTLEMENT_DOC).get();
    return doc.exists() ? doc.data() : { costs: {} };
  } catch (error) {
    console.error("Error in getSettlementConfig:", error);
    throw new HttpsError("internal", "정산 설정을 불러오는 데 실패했습니다.");
  }
});

exports.setSettlementCost = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { year, cost } = req.data;
  if (!year || typeof cost !== 'number' || cost < 0) throw new HttpsError('invalid-argument', '올바른 연도와 비용을 입력해주세요.');
  try {
    await db.collection(CONFIG_COLLECTION).doc(SETTLEMENT_DOC).set({ costs: { [String(year)]: cost } }, { merge: true });
    return { ok: true };
  } catch (error) {
    console.error("Error in setSettlementCost:", error);
    throw new HttpsError("internal", "비용 설정 저장에 실패했습니다.");
  }
});

exports.calculateSettlement = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  const { startDate, endDate } = req.data;
  if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) throw new HttpsError('invalid-argument', '유효한 시작일과 종료일이 필요합니다.');
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const leadsSnap = await db.collection(LEADS_COLLECTION).where('downloadedAt', '>=', start).where('downloadedAt', '<=', end).get();
    const settlementDoc = await db.collection(CONFIG_COLLECTION).doc(SETTLEMENT_DOC).get();
    const costs = settlementDoc.exists() ? settlementDoc.data().costs : {};
    const dailyData = {};
    leadsSnap.docs.forEach(doc => {
      const lead = doc.data();
      if (lead.downloadedAt) {
        const dateStr = formatInTimeZone(lead.downloadedAt.toDate(), 'Asia/Seoul', 'yyyy-MM-dd');
        if (!dailyData[dateStr]) dailyData[dateStr] = { downloads: 0, bads: 0, date: dateStr };
        dailyData[dateStr].downloads++;
        if (lead.isBad) dailyData[dateStr].bads++;
      }
    });
    const year = start.getFullYear().toString();
    const costPerLead = costs[year] || 0;
    return { dailyData: Object.values(dailyData), costPerLead };
  } catch (error) {
    console.error("Error in calculateSettlement:", error);
    throw new HttpsError("internal", "정산 데이터 계산 중 오류가 발생했습니다.");
  }
});

exports.getHistory = onCall({ invoker: "public" }, async (req) => {
  await ensureIsRole(req, ["super-admin"]);
  const { limit = 100 } = req.data;
  if (typeof limit !== 'number' || limit <= 0 || limit > 500) throw new HttpsError('invalid-argument', 'limit은 1과 500 사이의 숫자여야 합니다.');
  try {
    const snapshot = await db.collection(HISTORY_COLLECTION).orderBy("timestamp", "desc").limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error in getHistory:", error);
    throw new HttpsError("internal", "히스토리 조회 중 오류가 발생했습니다.");
  }
});

exports.getAdvancedDashboardStats = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  try {
    const timeZone = "Asia/Seoul";
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [todaySnapshot, yesterdaySnapshot, trendSnapshot, totalLeadsSnapshot] = await Promise.all([
      db.collection(LEADS_COLLECTION).where('createdAt', '>=', startOfToday).get(),
      db.collection(LEADS_COLLECTION).where('createdAt', '>=', subDays(startOfToday, 1)).where('createdAt', '<', startOfToday).get(),
      db.collection(LEADS_COLLECTION).where('createdAt', '>=', subDays(startOfToday, 29)).get(),
      db.collection(LEADS_COLLECTION).count().get()
    ]);
    const reduceBySource = (acc, lead) => {
      const source = lead.utm_source || 'N/A';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    };
    const todayLeads = todaySnapshot.docs.map(doc => doc.data());
    const yesterdayLeads = yesterdaySnapshot.docs.map(doc => doc.data());
    const trendLeads = trendSnapshot.docs.map(doc => doc.data());
    const allSources = new Set(trendLeads.map(lead => lead.utm_source || 'N/A'));
    const dailyCountsBySource = {};
    for (let i = 0; i < 30; i++) {
      dailyCountsBySource[formatInTimeZone(subDays(startOfToday, i), timeZone, 'yyyy-MM-dd')] = {};
    }
    trendLeads.forEach(lead => {
      if (lead.createdAt) {
        const dateString = formatInTimeZone(lead.createdAt.toDate(), timeZone, 'yyyy-MM-dd');
        const source = lead.utm_source || 'N/A';
        if (dailyCountsBySource[dateString]) {
          dailyCountsBySource[dateString][source] = (dailyCountsBySource[dateString][source] || 0) + 1;
        }
      }
    });
    const trendData = Object.keys(dailyCountsBySource).map(date => ({
      date,
      ...Object.fromEntries([...allSources].map(source => [source, dailyCountsBySource[date][source] || 0]))
    })).sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      yesterday: { total: yesterdayLeads.length, bad: yesterdayLeads.filter(l => l.isBad).length, bySource: yesterdayLeads.reduce(reduceBySource, {}) },
      today: { total: todayLeads.length, bad: todayLeads.filter(l => l.isBad).length, bySource: todayLeads.reduce(reduceBySource, {}) },
      trend: trendData,
      cumulativeTotal: totalLeadsSnapshot.data().count,
      sources: [...allSources],
      cumulativeBySource: trendLeads.reduce(reduceBySource, {}),
    };
  } catch (error) {
    console.error("Error in getAdvancedDashboardStats:", error);
    throw new HttpsError("internal", "대시보드 통계 데이터 조회 중 오류가 발생했습니다.");
  }
});

exports.setAdCost = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { date, source, cost } = req.data;
  if (!date || !source || typeof cost !== 'number' || cost < 0) throw new HttpsError('invalid-argument', '날짜, 매체, 그리고 0 이상의 광고비(숫자)를 입력해주세요.');
  try {
    await db.collection(AD_COSTS_COLLECTION).doc(date).set({ [source]: cost }, { merge: true });
    return { ok: true };
  } catch (error) {
    console.error("Error in setAdCost:", error);
    throw new HttpsError("internal", "광고비 저장에 실패했습니다.");
  }
});

const highMemoryOptions = { region: "asia-northeast3", memory: "512MiB", timeoutSeconds: 120 };

exports.getRoasData = onCall(highMemoryOptions, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin']);
  const { startDate, endDate } = req.data;
  if (!startDate || !endDate || isNaN(new Date(startDate)) || isNaN(new Date(endDate))) {
    throw new HttpsError('invalid-argument', '유효한 시작일과 종료일이 필요합니다.');
  }
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeZone = 'Asia/Seoul';
    const [leadsSnap, adCostsSnap, settlementDoc] = await Promise.all([
      db.collection(LEADS_COLLECTION).where('createdAt', '>=', start).where('createdAt', '<=', end).get(),
      db.collection(AD_COSTS_COLLECTION).get(),
      db.collection(CONFIG_COLLECTION).doc(SETTLEMENT_DOC).get()
    ]);
    const costsConfig = settlementDoc.exists() ? settlementDoc.data().costs : {};
    const combinedData = {};
    const allSourcesInPeriod = new Set();
    leadsSnap.docs.forEach(doc => {
      const lead = doc.data();
      if (!lead.createdAt) return;
      const dateStr = formatInTimeZone(lead.createdAt.toDate(), timeZone, 'yyyy-MM-dd');
      const source = lead.utm_source || 'N/A';
      allSourcesInPeriod.add(source);
      const key = `${dateStr}|${source}`;
      if (!combinedData[key]) combinedData[key] = { leads: 0, revenue: 0, cost: 0 };
      const year = String(lead.createdAt.toDate().getFullYear());
      combinedData[key].leads++;
      combinedData[key].revenue += costsConfig[year] || 0;
    });
    const startDateStr = formatInTimeZone(start, timeZone, 'yyyy-MM-dd');
    const endDateStr = formatInTimeZone(end, timeZone, 'yyyy-MM-dd');
    adCostsSnap.docs.forEach(doc => {
      const dateStr = doc.id;
      if (dateStr >= startDateStr && dateStr <= endDateStr) {
        const costs = doc.data();
        for (const source in costs) {
          allSourcesInPeriod.add(source);
          const key = `${dateStr}|${source}`;
          if (!combinedData[key]) combinedData[key] = { leads: 0, revenue: 0, cost: 0 };
          combinedData[key].cost += Number(costs[source] || 0);
        }
      }
    });
    const roasData = [];
    if (allSourcesInPeriod.size === 0) allSourcesInPeriod.add("N/A");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatInTimeZone(d, timeZone, 'yyyy-MM-dd');
      allSourcesInPeriod.forEach(source => {
        const data = combinedData[`${dateStr}|${source}`] || {};
        roasData.push({ date: dateStr, source, cost: data.cost || 0, leads: data.leads || 0, revenue: data.revenue || 0, roas: (data.cost > 0) ? (data.revenue / data.cost) * 100 : 0 });
      });
    }
    const today = new Date();
    const trendStartDate = subDays(today, 29);
    const trendCostsSnap = await db.collection(AD_COSTS_COLLECTION)
      .where(admin.firestore.FieldPath.documentId(), '>=', formatInTimeZone(trendStartDate, timeZone, 'yyyy-MM-dd'))
      .where(admin.firestore.FieldPath.documentId(), '<=', formatInTimeZone(today, timeZone, 'yyyy-MM-dd'))
      .get();
    const trendCosts = {};
    trendCostsSnap.forEach(doc => {
      trendCosts[doc.id] = Object.values(doc.data()).reduce((sum, val) => sum + Number(val || 0), 0);
    });
    const trendData = Array.from({ length: 30 }).map((_, i) => {
      const date = subDays(today, 29 - i);
      const dateStr = formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
      return { date: dateStr, cost: trendCosts[dateStr] || 0 };
    });
    const weekStart = startOfWeek(today);
    const monthStart = startOfMonth(today);
    const [weekLeadsSnap, monthLeadsSnap, weekCostsSnap, monthCostsSnap] = await Promise.all([
      db.collection(LEADS_COLLECTION).where('createdAt', '>=', weekStart).count().get(),
      db.collection(LEADS_COLLECTION).where('createdAt', '>=', monthStart).count().get(),
      db.collection(AD_COSTS_COLLECTION).where(admin.firestore.FieldPath.documentId(), '>=', formatInTimeZone(weekStart, timeZone, 'yyyy-MM-dd')).get(),
      db.collection(AD_COSTS_COLLECTION).where(admin.firestore.FieldPath.documentId(), '>=', formatInTimeZone(monthStart, timeZone, 'yyyy-MM-dd')).get(),
    ]);
    const weekLeads = weekLeadsSnap.data().count;
    const monthLeads = monthLeadsSnap.data().count;
    const weekCost = weekCostsSnap.docs.reduce((sum, doc) => sum + Object.values(doc.data()).reduce((s, v) => s + Number(v || 0), 0), 0);
    const monthCost = monthCostsSnap.docs.reduce((sum, doc) => sum + Object.values(doc.data()).reduce((s, v) => s + Number(v || 0), 0), 0);
    const coreMetrics = {
      thisWeekCostPerLead: weekLeads > 0 ? weekCost / weekLeads : 0,
      thisMonthCostPerLead: monthLeads > 0 ? monthCost / monthLeads : 0,
    };
    return { roasData, trendData, coreMetrics };
  } catch (error) {
    console.error("Error in getRoasData:", error);
    throw new HttpsError("internal", "ROAS 데이터 조회 중 오류가 발생했습니다.");
  }
});

exports.createLeadFromPostback = onRequest({ region: "asia-northeast3", cors: true }, async (req, res) => {
  try {
    const data = req.method === "POST" ? req.body : req.query;
    const { name, phone, region, ...restData } = data || {};
    if (!name || !phone || !region) return res.status(400).json({ error: "name, phone, region are required" });
    const phoneDigits = String(phone).replace(/\D/g, "");
    if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) return res.status(400).json({ error: "Invalid phone number format." });
    const phoneE164 = "+82" + phoneDigits.substring(1);
    const snapshot = await db.collection(LEADS_COLLECTION).where("phone_e164", "==", phoneE164).limit(1).get();
    if (!snapshot.empty) return res.status(409).json({ error: "This phone number is already registered." });
    const ip = req.ip || req.headers['x-forwarded-for'] || req.headers['connection']?.remoteAddress;
    const geo = ip ? geoip.lookup(ip.split(',')[0]) : null;
    const newLeadRef = db.collection(LEADS_COLLECTION).doc();
    const newLead = { id: newLeadRef.id, name: String(name).trim(), phone_raw: formatPhoneNumber(phone), phone_e164, region_ko: region, ...restData, createdAt: FieldValue.serverTimestamp(), ipAddress: ip || null, ipCity: geo ? `${geo.country}, ${geo.city}` : 'Unknown', download: 0, isBad: false, memo: "", visited: false, procedure: false };
    await newLeadRef.set(newLead);
    return res.status(200).json({ ok: true, id: newLeadRef.id });
  } catch (err) {
    console.error("Error in createLeadFromPostback:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

exports.enrichLeadDataFromBigQuery = onDocumentCreated(`${LEADS_COLLECTION}/{leadId}`, async (event) => {
  try {
    const snapshot = event.data;
    if (!snapshot) return;
    const leadData = snapshot.data();
    const gaClientId = leadData.ga_client_id;
    if (!gaClientId) return;
    const userPseudoId = gaClientId.split('.').slice(0, 2).join('.');
    const table = "`planplant-database.analytics_373516361.events_*`";
    const query = `SELECT traffic_source.source as source, traffic_source.medium as medium, traffic_source.name as campaign FROM ${table} WHERE user_pseudo_id = @userPseudoId AND event_name = 'session_start' ORDER BY event_timestamp DESC LIMIT 1`;
    const [rows] = await bigquery.query({ query, params: { userPseudoId } });
    if (rows.length > 0) {
      const { source, medium, campaign } = rows[0];
      await snapshot.ref.update({ utm_source: source || '(not set)', utm_medium: medium || '(not set)', utm_campaign: campaign || '(not set)' });
      console.log(`Successfully enriched lead ${snapshot.id}`);
    } else {
      console.log(`No campaign data found for ga_client_id: ${gaClientId}`);
    }
  } catch (e) {
    console.error(`Error in enrichLeadDataFromBigQuery for lead ${event.params.leadId}:`, e);
  }
});

exports.sendDailySummary = onSchedule({ schedule: "every day 05:00", timeZone: "Asia/Seoul" }, async () => {
  try {
    const now = new Date();
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    const snapshot = await db.collection(LEADS_COLLECTION).where("createdAt", ">=", startOfYesterday).where("createdAt", "<=", endOfYesterday).get();
    if (snapshot.empty) {
      console.log("No leads to summarize for yesterday.");
      return;
    }
    const leads = snapshot.docs.map(doc => doc.data());
    const summaryDate = formatInTimeZone(startOfYesterday, "Asia/Seoul", 'yyyy년 MM월 dd일');
    const sourceCounts = leads.reduce((acc, lead) => {
      const source = lead.utm_source || 'N/A';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    const sourceCountsHtml = Object.entries(sourceCounts).map(([source, count]) => `<li>${source} : ${count}건</li>`).join('');
    const leadsHtml = leads.map(lead => `<li>${lead.name} (${lead.phone_raw}), ${lead.utm_source || 'N/A'}, ${lead.region_ko}</li>`).join('');
    const { roles, notifications } = await getAdminConfig();
    const recipients = Object.keys(roles).filter(email => notifications?.[email.replace(/\./g, "_")]?.notifyOnDailySummary !== false);
    if (recipients.length > 0) {
      await db.collection(MAIL_COLLECTION).add({ to: recipients, from: 'contact@planplant.io', template: { name: 'daily-summary', data: { summaryDate, totalLeads: leads.length, sourceCountsHtml, leadsHtml } } });
    }
  } catch (error) {
    console.error("Error in sendDailySummary:", error);
  }
});

exports.fetchAdCostsScheduled = onSchedule({ schedule: "every day 04:00", timeZone: "Asia/Seoul" }, async () => {
  console.log("Starting daily ad cost fetching...");
  const yesterday = subDays(new Date(), 1);
  const dateStr = formatInTimeZone(yesterday, 'Asia/Seoul', 'yyyy-MM-dd');
  try {
    const apiConfigDoc = await db.collection(CONFIG_COLLECTION).doc(API_CREDENTIALS_DOC).get();
    if (!apiConfigDoc.exists()) {
      console.log("API credentials not found, skipping.");
      return;
    }
    // const apiConfig = apiConfigDoc.data();
    const costsToUpdate = {};
    if (Object.keys(costsToUpdate).length > 0) {
      await db.collection(AD_COSTS_COLLECTION).doc(dateStr).set(costsToUpdate, { merge: true });
      console.log(`Ad costs for ${dateStr} collected:`, costsToUpdate);
    } else {
      console.log(`No ad costs collected for ${dateStr}.`);
    }
  } catch (error) {
    console.error("Error fetching ad costs:", error);
  }
});

exports.getApiSettings = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  try {
    const doc = await db.collection(CONFIG_COLLECTION).doc(API_CREDENTIALS_DOC).get();
    if (!doc.exists()) return {};
    const settings = doc.data();
    if (settings.google) delete settings.google.clientSecret;
    if (settings.tiktok) delete settings.tiktok.secret;
    return settings;
  } catch (error) {
    console.error("Error in getApiSettings:", error);
    throw new HttpsError("internal", "API 설정 정보를 불러오는 데 실패했습니다.");
  }
});

exports.saveApiSettings = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { settings } = req.data;
  if (!settings || (!settings.tiktok && !settings.google)) throw new HttpsError('invalid-argument', '저장할 API 설정 정보가 없습니다.');
  try {
    await db.collection(CONFIG_COLLECTION).doc(API_CREDENTIALS_DOC).set(settings, { merge: true });
    return { ok: true };
  } catch (error) {
    console.error("Error in saveApiSettings:", error);
    throw new HttpsError("internal", "API 설정 정보 저장에 실패했습니다.");
  }
});