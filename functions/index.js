// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/functions/index.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { formatInTimeZone } = require("date-fns-tz");
const { subDays } = require("date-fns");
const { BigQuery } = require("@google-cloud/bigquery");
const geoip = require("geoip-lite");

setGlobalOptions({ region: "asia-northeast3" });
admin.initializeApp();
const bigquery = new BigQuery();

const db = getFirestore("customer-database");
const LEADS = "leads";
const HISTORY = "history";

// --- Helper Functions ---
const getAdminRoles = async () => {
  const adminDoc = await db.collection("_config").doc("admins").get();
  if (!adminDoc.exists) {
    console.error("CRITICAL: '_config/admins' document not found!");
    return { roles: {} };
  }
  return adminDoc.data() || { roles: {} };
};

const ensureIsRole = async (context, allowedRoles) => {
  const email = context.auth?.token?.email;
  if (!email) throw new HttpsError("unauthenticated", "Authentication required.");

  const adminConfig = await getAdminRoles();
  const roles = adminConfig.roles || {};
  const normalizedEmail = email.trim().toLowerCase();
  let userRole = null;

  // ✨ (버그 해결) Firestore에 저장된 이메일 키도 소문자로 비교
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

exports.getMyRole = onCall({ invoker: 'public' }, async (req) => {
  const email = req.auth?.token?.email;
  if (!email) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }
  const adminConfig = await getAdminRoles();
  const roles = adminConfig.roles || {};
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

  const adminConfig = await getAdminRoles();
  const roles = adminConfig.roles || {};
  const notifications = adminConfig.notifications || {};

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
    const emailKey = email.replace(/\./g, "_");
    const notificationPrefs = notifications[emailKey] || {};
    return {
      email,
      role,
      lastSignInTime: authData ? authData.lastSignInTime : null,
      notifyOnNewLead: notificationPrefs.notifyOnNewLead !== false,
      notifyOnDailySummary: notificationPrefs.notifyOnDailySummary !== false,
    };
  });

  return combinedAdmins;
});

exports.addAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, role } = req.data;
  if (!email || !['admin', 'user'].includes(role)) throw new HttpsError('invalid-argument', 'A valid email and role are required.');

  const docRef = db.collection('_config').doc('admins');
  const emailKey = email.replace(/\./g, "_");
  await docRef.set({
    roles: { [email]: role },
    notifications: { [emailKey]: { notifyOnNewLead: true, notifyOnDailySummary: true } }
  }, { merge: true });

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

exports.updateAdminNotifications = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email, field, value } = req.data;
  if (!email || !field || typeof value !== 'boolean') {
    throw new HttpsError('invalid-argument', 'A valid email, field, and value are required.');
  }

  const docRef = db.collection('_config').doc('admins');
  const emailKey = email.replace(/\./g, "_");
  const fieldPath = new admin.firestore.FieldPath('notifications', emailKey, field);

  await docRef.update({ [fieldPath]: value });
  return { ok: true };
});

exports.removeAdmin = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { email } = req.data;
  if (!email) throw new HttpsError('invalid-argument', 'Email is required.');

  const docRef = db.collection('_config').doc('admins');
  const emailKey = email.replace(/\./g, "_");

  const updates = {};
  updates[`roles.${email}`] = FieldValue.delete();
  updates[`notifications.${emailKey}`] = FieldValue.delete();

  await docRef.update(updates);
  return { ok: true };
});

exports.createLeadCall = onCall({ invoker: "public" }, async (req) => {
  const ip = req.ip || req.rawRequest.headers['x-forwarded-for'] || req.rawRequest.connection.remoteAddress;
  const geo = geoip.lookup(ip);

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
    ipAddress: ip,
    ipCity: geo ? `${geo.country}, ${geo.city}` : 'Unknown',
    download: 0,
    isBad: false,
    memo: "",
    visited: false,
    procedure: false,
  };

  const adminConfig = await getAdminRoles();
  const roles = adminConfig.roles || {};
  const notifications = adminConfig.notifications || {};
  const recipients = Object.keys(roles).filter(email => {
    const emailKey = email.replace(/\./g, "_");
    return notifications[emailKey]?.notifyOnNewLead !== false;
  });

  if (recipients.length > 0) {
    await db.collection("mail").add({
      to: recipients,
      from: 'contact@planplant.io',
      message: {
        subject: `[기획공장] ${newLead.name}님의 상담신청이 접수되었습니다.`,
        html: `<h3>상담신청 정보</h3>
                 <p><strong>이름 :</strong> ${newLead.name}</p>
                 <p><strong>연락처 :</strong> ${newLead.phone_raw}</p>
                 <p><strong>지역 :</strong> ${newLead.region_ko}</p>`,
      },
    });
  }

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

exports.setLeadStatus = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin', 'user']);
  const { leadId, field, status } = req.data;

  if (!leadId || !field || typeof status !== 'boolean') {
    throw new HttpsError('invalid-argument', 'leadId, field, and a boolean status are required.');
  }

  const allowedFields = ['isBad', 'visited', 'procedure'];
  if (!allowedFields.includes(field)) {
    throw new HttpsError('invalid-argument', `Field '${field}' is not updatable.`);
  }

  await db.collection(LEADS).doc(leadId).update({ [field]: status });
  return { ok: true };
});

exports.sendDailySummary = onSchedule({ schedule: "every day 05:00", timeZone: "Asia/Seoul" }, async () => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
  const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));
  const snapshot = await db.collection(LEADS).where("createdAt", ">=", startOfYesterday).where("createdAt", "<=", endOfYesterday).get();
  if (snapshot.empty) return null;

  const leads = snapshot.docs.map(doc => doc.data());
  const totalLeads = leads.length;
  const summaryDate = formatInTimeZone(startOfYesterday, "Asia/Seoul", 'yyyy년 MM월 dd일');

  const sourceCounts = leads.reduce((acc, lead) => {
    const source = lead.utm_source || 'N/A';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  const sourceCountsHtml = Object.entries(sourceCounts)
    .map(([source, count]) => `<li>${source} : ${count}건</li>`)
    .join('');

  const leadsHtml = leads.map(lead => `<li>${lead.name} (${lead.phone_raw}), ${lead.utm_source || 'N/A'}, ${lead.region_ko}</li>`).join('');

  const adminConfig = await getAdminRoles();
  const roles = adminConfig.roles || {};
  const notifications = adminConfig.notifications || {};
  const recipients = Object.keys(roles).filter(email => {
    const emailKey = email.replace(/\./g, "_");
    return notifications[emailKey]?.notifyOnDailySummary !== false;
  });

  if (recipients.length > 0) {
    await db.collection("mail").add({
      to: recipients,
      from: 'contact@planplant.io',
      message: {
        subject: `[기획공장] ${summaryDate} 상담접수 종합 (${totalLeads}건)`,
        html: `<h3>매체별 유입 수</h3>
                 <ul>${sourceCountsHtml}</ul>
                 <h3>상담신청 상세</h3>
                 <ul>${leadsHtml}</ul>`,
      },
    });
  }
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

exports.getHistory = onCall({ invoker: "public" }, async (req) => {
  await ensureIsRole(req, ["super-admin"]);
  const { limit = 100 } = req.data;
  const snapshot = await db.collection(HISTORY).orderBy("timestamp", "desc").limit(limit).get();

  const historyData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const leadIds = [...new Set(historyData.map((log) => log.leadId).filter(Boolean))];

  if (leadIds.length > 0) {
    const leadPromises = [];
    for (let i = 0; i < leadIds.length; i += 30) {
      const chunk = leadIds.slice(i, i + 30);
      leadPromises.push(db.collection(LEADS).where("id", "in", chunk).get());
    }

    const leadSnapshots = await Promise.all(leadPromises);
    const leadsMap = new Map();
    leadSnapshots.forEach(snap => {
      snap.forEach((doc) => {
        leadsMap.set(doc.id, doc.data());
      });
    });

    historyData.forEach((log) => {
      if (log.leadId && leadsMap.has(log.leadId)) {
        const lead = leadsMap.get(log.leadId);
        log.leadName = lead.name;
        log.leadPhone = lead.phone_raw;
      }
    });
  }

  return historyData;
});

exports.getAdvancedDashboardStats = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin', 'admin', 'user']);

  const timeZone = "Asia/Seoul";
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const yesterdayDate = subDays(startOfToday, 1);
  const startOfYesterday = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 0, 0, 0);
  const endOfYesterday = new Date(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 23, 59, 59, 999);

  const trendStartDate = subDays(startOfToday, 29);

  const todayQuery = db.collection(LEADS).where('createdAt', '>=', startOfToday).where('createdAt', '<=', endOfToday).get();
  const yesterdayQuery = db.collection(LEADS).where('createdAt', '>=', startOfYesterday).where('createdAt', '<=', endOfYesterday).get();
  const trendQuery = db.collection(LEADS).where('createdAt', '>=', trendStartDate).get();
  const totalLeadsQuery = db.collection(LEADS).count().get();

  const [todaySnapshot, yesterdaySnapshot, trendSnapshot, totalLeadsSnapshot] = await Promise.all([todayQuery, yesterdayQuery, trendQuery, totalLeadsQuery]);

  const reduceBySource = (acc, lead) => {
    const source = lead.utm_source || 'N/A';
    if (!acc[source]) acc[source] = 0;
    acc[source]++;
    return acc;
  };

  const todayLeads = todaySnapshot.docs.map(doc => doc.data());
  const todayStats = {
    total: todayLeads.length,
    bad: todayLeads.filter(lead => lead.isBad).length,
    bySource: todayLeads.reduce(reduceBySource, {}),
  };

  const yesterdayLeads = yesterdaySnapshot.docs.map(doc => doc.data());
  const yesterdayStats = {
    total: yesterdayLeads.length,
    bad: yesterdayLeads.filter(lead => lead.isBad).length,
    bySource: yesterdayLeads.reduce(reduceBySource, {}),
  };

  const trendLeads = trendSnapshot.docs.map(doc => doc.data());
  const allSources = new Set();
  const dailyCountsBySource = {};

  for (let i = 0; i < 30; i++) {
    const date = subDays(startOfToday, i);
    const dateString = formatInTimeZone(date, timeZone, 'yyyy-MM-dd');
    dailyCountsBySource[dateString] = {};
  }

  trendLeads.forEach(lead => {
    const dateString = formatInTimeZone(lead.createdAt.toDate(), timeZone, 'yyyy-MM-dd');
    const source = lead.utm_source || 'N/A';
    allSources.add(source);
    if (dailyCountsBySource[dateString]) {
      if (!dailyCountsBySource[dateString][source]) {
        dailyCountsBySource[dateString][source] = 0;
      }
      dailyCountsBySource[dateString][source]++;
    }
  });

  const trendData = Object.keys(dailyCountsBySource)
    .map(date => {
      const entry = { date };
      allSources.forEach(source => {
        entry[source] = dailyCountsBySource[date][source] || 0;
      });
      return entry;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const cumulativeBySource = trendLeads.reduce(reduceBySource, {});

  return {
    yesterday: yesterdayStats,
    today: todayStats,
    trend: trendData,
    cumulativeTotal: totalLeadsSnapshot.data().count,
    sources: [...allSources],
    cumulativeBySource: cumulativeBySource,
  };
});

exports.enrichLeadDataFromBigQuery = onDocumentCreated("leads/{leadId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return;
  }
  const leadData = snapshot.data();
  const gclid = leadData.gclid;

  if (!gclid) {
    console.log(`Lead ${snapshot.id} has no gclid. Skipping.`);
    return;
  }

  const table = "`planplant-database.analytics_373516361.events_*`";

  const query = `
      SELECT
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'source') as source,
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'medium') as medium,
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'campaign') as campaign
      FROM
          ${table}
      WHERE
          (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'gclid') = @gclid
      LIMIT 1`;

  const options = {
    query: query,
    params: { gclid: gclid },
  };

  try {
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      const campaignData = rows[0];
      const updateData = {
        utm_source: campaignData.source || 'google',
        utm_medium: campaignData.medium || 'cpc',
        utm_campaign: campaignData.campaign || '(not set)',
      };

      await snapshot.ref.update(updateData);
      console.log(`Successfully enriched lead ${snapshot.id} with data:`, updateData);
    } else {
      console.log(`No campaign data found in BigQuery for gclid: ${gclid}`);
    }
  } catch (e) {
    console.error(`Error enriching lead ${snapshot.id} from BigQuery:`, e);
  }
});