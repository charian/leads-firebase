// charian/leads-firebase/leads-firebase-055a667c5c853ad85aee2ec7f79d21492d3b2ea1/functions/index.js (안정화 최종본)

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
const axios = require("axios");

setGlobalOptions({ region: "asia-northeast3" });
admin.initializeApp();
const bigquery = new BigQuery();

const db = getFirestore("customer-database");
const LEADS = "leads";
const HISTORY = "history";
const AD_COSTS = "ad_costs";

// --- Helper Functions ---
const getAdminRoles = async () => {
  const adminDoc = await db.collection("_config").doc("admins").get();
  if (!adminDoc.exists) {
    console.error("CRITICAL: '_config/admins' document not found!");
    return { roles: {} };
  }
  return adminDoc.data() || { roles: {} };
};

const ensureIsRole = async (req, allowedRoles) => {
  const email = req.auth?.token?.email;
  if (!email) throw new HttpsError("unauthenticated", "Authentication required.");

  const adminConfig = await getAdminRoles();
  const roles = adminConfig.roles || {};
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

  const { name, phone, region, referrer, ...restData } = req.data || {};
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
    referrer: referrer || "",
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
                 <p><strong>지역 :</strong> ${newLead.region_ko}</p>
                 <p><strong>유입경로 :</strong> ${newLead.referrer || '직접 유입'}</p>`,
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

  const [todaySnapshot, yesterdaySnapshot, trendSnapshot, totalLeadsSnapshot] = await Promise.all([
    db.collection(LEADS).where('createdAt', '>=', startOfToday).where('createdAt', '<=', endOfToday).get(),
    db.collection(LEADS).where('createdAt', '>=', startOfYesterday).where('createdAt', '<=', endOfYesterday).get(),
    db.collection(LEADS).where('createdAt', '>=', trendStartDate).get(),
    db.collection(LEADS).count().get()
  ]);

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

  const gaClientId = leadData.ga_client_id;

  if (!gaClientId) {
    console.log(`Lead ${snapshot.id} has no ga_client_id. Skipping.`);
    return;
  }

  const userPseudoId = gaClientId.split('.')[0] + '.' + gaClientId.split('.')[1];

  const table = "`planplant-database.analytics_373516361.events_*`";

  const query = `
      SELECT
          traffic_source.source as source,
          traffic_source.medium as medium,
          traffic_source.name as campaign
      FROM
          ${table}
      WHERE
          user_pseudo_id = @userPseudoId
          AND event_name = 'session_start'
      ORDER BY
          event_timestamp DESC
      LIMIT 1`;

  const options = {
    query: query,
    params: { userPseudoId: userPseudoId },
  };

  try {
    const [rows] = await bigquery.query(options);

    if (rows.length > 0) {
      const campaignData = rows[0];
      const updateData = {
        utm_source: campaignData.source || '(not set)',
        utm_medium: campaignData.medium || '(not set)',
        utm_campaign: campaignData.campaign || '(not set)',
      };

      await snapshot.ref.update(updateData);
      console.log(`Successfully enriched lead ${snapshot.id} with data from ga_client_id:`, updateData);
    } else {
      console.log(`No campaign data found in BigQuery for ga_client_id: ${gaClientId}`);
    }
  } catch (e) {
    console.error(`Error enriching lead ${snapshot.id} from BigQuery using ga_client_id:`, e);
  }
});

exports.createLeadFromPostback = onRequest(
  {
    region: "asia-northeast3",
    cors: true,
    memory: "512MiB"
  },
  async (req, res) => {
    console.log("Postback received. Method:", req.method);
    console.log("Query parameters:", JSON.stringify(req.query));
    console.log("Body:", JSON.stringify(req.body));

    const data = req.method === "POST" ? req.body : req.query;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.headers['connection'].remoteAddress;
    const geo = geoip.lookup(ip);

    const { name, phone, region, gclid, atTrackId, ...restData } = data || {};

    if (!name || !phone || !region) {
      console.error("Validation failed: name, phone, or region is missing.", data);
      return res.status(400).json({ error: "name, phone, region are required" });
    }

    try {
      const phoneDigits = String(phone).replace(/\D/g, "");
      if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) {
        console.error("Validation failed: Invalid phone number format.", { phone });
        return res.status(400).json({ error: "Invalid phone number format." });
      }
      const phoneE164 = "+82" + phoneDigits.substring(1);

      const snapshot = await db.collection(LEADS).where("phone_e164", "==", phoneE164).limit(1).get();
      if (!snapshot.empty) {
        console.log("Duplicate phone number found:", phoneE164);
        return res.status(409).json({ error: "This phone number is already registered." });
      }

      const newLeadRef = db.collection(LEADS).doc();
      const newLead = {
        id: newLeadRef.id,
        name: String(name).trim(),
        phone_raw: formatPhoneNumber(phone),
        phone_e164: phoneE164,
        region_ko: region,
        gclid: gclid || null,
        atTrackId: atTrackId || null,
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

      await newLeadRef.set(newLead);
      console.log("Successfully created lead:", newLeadRef.id);

      return res.status(200).json({ ok: true, id: newLeadRef.id });

    } catch (err) {
      console.error("Error during lead creation process:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

exports.setAdCost = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { date, source, cost } = req.data;

  if (!date || !source || typeof cost !== 'number' || cost < 0) {
    throw new HttpsError('invalid-argument', 'date, source, and a non-negative cost are required.');
  }

  const docRef = db.collection(AD_COSTS).doc(date);
  await docRef.set({ [source]: cost }, { merge: true });

  return { ok: true };
});

exports.getRoasData = onCall({ invoker: 'public' }, async (req) => {
  await ensureIsRole(req, ['super-admin']);
  const { startDate, endDate } = req.data;
  if (!startDate || !endDate) {
    throw new HttpsError('invalid-argument', 'startDate and endDate are required.');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeZone = 'Asia/Seoul';

  // --- 1. 데이터 조회 (효율적으로) ---
  const [leadsSnap, adCostsSnap, settlementDoc] = await Promise.all([
    db.collection(LEADS).where('createdAt', '>=', start).where('createdAt', '<=', end).get(),
    db.collection(AD_COSTS)
      .where(admin.firestore.FieldPath.documentId(), '>=', formatInTimeZone(start, timeZone, 'yyyy-MM-dd'))
      .where(admin.firestore.FieldPath.documentId(), '<=', formatInTimeZone(end, timeZone, 'yyyy-MM-dd'))
      .get(),
    db.collection('_config').doc('settlement').get()
  ]);
  const costsConfig = settlementDoc.exists ? settlementDoc.data().costs : {};

  // --- 2. 데이터 가공 ---
  const combinedData = {};
  const allSourcesInPeriod = new Set();

  leadsSnap.docs.forEach(doc => {
    const lead = doc.data();
    const dateStr = formatInTimeZone(lead.createdAt.toDate(), timeZone, 'yyyy-MM-dd');
    const source = lead.utm_source || 'N/A';
    allSourcesInPeriod.add(source);
    const key = `${dateStr}|${source}`;
    if (!combinedData[key]) combinedData[key] = { leads: 0, revenue: 0, cost: 0 };
    const year = String(lead.createdAt.toDate().getFullYear());
    const costPerLead = costsConfig[year] || 0;
    combinedData[key].leads += 1;
    combinedData[key].revenue += costPerLead;
  });

  adCostsSnap.docs.forEach(doc => {
    const dateStr = doc.id;
    const costs = doc.data();
    for (const source in costs) {
      allSourcesInPeriod.add(source);
      const key = `${dateStr}|${source}`;
      if (!combinedData[key]) combinedData[key] = { leads: 0, revenue: 0, cost: 0 };
      combinedData[key].cost += Number(costs[source] || 0);
    }
  });

  // --- 3. 모든 날짜와 매체 조합으로 최종 데이터 생성 ---
  const roasData = [];
  if (allSourcesInPeriod.size === 0) { allSourcesInPeriod.add("N/A"); }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatInTimeZone(d, timeZone, 'yyyy-MM-dd');
    allSourcesInPeriod.forEach(source => {
      const key = `${dateStr}|${source}`;
      const data = combinedData[key] || {};
      roasData.push({
        date: dateStr,
        source: source,
        cost: data.cost || 0,
        leads: data.leads || 0,
        revenue: data.revenue || 0,
        roas: (data.cost > 0) ? ((data.revenue || 0) / data.cost) * 100 : 0
      });
    });
  }

  // --- 4. 핵심 지표 및 트렌드 데이터 (효율적으로 재구현) ---
  const today = new Date();

  // 광고비 트렌드 데이터 (최근 30일)
  const trendStartDate = subDays(today, 29);
  const trendCostsSnap = await db.collection(AD_COSTS)
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

  // 주간/월간 리드당 비용 계산
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const [weekLeadsSnap, monthLeadsSnap, weekCostsSnap, monthCostsSnap] = await Promise.all([
    db.collection(LEADS).where('createdAt', '>=', weekStart).get(),
    db.collection(LEADS).where('createdAt', '>=', monthStart).get(),
    db.collection(AD_COSTS).where(admin.firestore.FieldPath.documentId(), '>=', formatInTimeZone(weekStart, timeZone, 'yyyy-MM-dd')).get(),
    db.collection(AD_COSTS).where(admin.firestore.FieldPath.documentId(), '>=', formatInTimeZone(monthStart, timeZone, 'yyyy-MM-dd')).get(),
  ]);

  const weekLeads = weekLeadsSnap.size;
  const monthLeads = monthLeadsSnap.size;

  let weekCost = 0;
  weekCostsSnap.forEach(doc => {
    weekCost += Object.values(doc.data()).reduce((s, v) => s + Number(v || 0), 0);
  });

  let monthCost = 0;
  monthCostsSnap.forEach(doc => {
    monthCost += Object.values(doc.data()).reduce((s, v) => s + Number(v || 0), 0);
  });

  const coreMetrics = {
    cumulativeCostPerLead: 0, // 누적 비용은 추후 안정적인 방식으로 추가
    thisWeekCostPerLead: weekLeads > 0 ? weekCost / weekLeads : 0,
    thisMonthCostPerLead: monthLeads > 0 ? monthCost / monthLeads : 0,
  };

  return { roasData, trendData, coreMetrics };
});

// TikTok 광고비 가져오기 (예시 함수)
async function fetchTiktokSpend(credentials, date) {
  if (!credentials || !credentials.advertiserId) {
    console.log("TikTok 인증 정보 또는 Advertiser ID가 없어 스킵합니다.");
    return 0;
  }

  // 중요: TikTok은 Access Token을 주기적으로 재발급 받아야 합니다.
  // 실제 운영 시에는 credentials.appId, credentials.secret 등을 사용하여
  // Access Token을 발급받는 로직을 여기에 구현해야 합니다.
  const accessToken = "여기에-실제-발급받은-Access-Token-을-입력하세요";

  const startDate = formatInTimeZone(date, 'Asia/Seoul', 'yyyy-MM-dd');
  const endDate = startDate;

  try {
    const response = await axios.get('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/', {
      headers: { 'Access-Token': accessToken },
      params: {
        advertiser_id: credentials.advertiserId,
        report_type: 'BASIC',
        dimensions: ['stat_time_day'],
        metrics: ['spend'],
        start_date: startDate,
        end_date: endDate,
      }
    });

    if (response.data.code !== 0) {
      console.error("TikTok API 오류:", response.data.message);
      return 0;
    }

    const spend = response.data?.data?.list?.[0]?.metrics?.spend || 0;
    return Number(spend);
  } catch (error) {
    console.error("TikTok 광고비 API 요청 실패:", error.response?.data || error.message);
    return 0;
  }
}

// Google Ads 광고비 가져오기 (예시 함수)
async function fetchGoogleAdsSpend(credentials, date) {
  // 실제 구현 시, GoogleAdsApi 클라이언트 초기화 및 인증 과정이 필요합니다.
  // const client = new GoogleAdsApi({
  //     client_id: credentials.clientId,
  //     client_secret: credentials.clientSecret,
  //     developer_token: credentials.developerToken,
  // });
  // const customer = client.Customer({
  //     refresh_token: credentials.refreshToken,
  //     login_customer_id: '로그인-계정-ID',
  //     customer_id: '광고-계정-ID', 
  // });

  // GAQL 쿼리를 사용하여 특정 날짜의 광고비를 가져옵니다.
  // const results = await customer.query(`
  //     SELECT metrics.cost_micros 
  //     FROM campaign 
  //     WHERE segments.date = '${formatInTimeZone(date, 'Asia/Seoul', 'yyyy-MM-dd')}'
  // `);

  // const totalCostMicros = results.reduce((sum, row) => sum + row.metrics.cost_micros, 0);
  // return totalCostMicros / 1000000; // Micros 단위를 일반 통화 단위로 변경
  return 0; // 이 부분은 실제 연동 시 위 주석 코드로 대체됩니다.
}


exports.fetchAdCostsScheduled = onSchedule({ schedule: "every day 04:00", timeZone: "Asia/Seoul" }, async () => {
  console.log("매일 광고비 자동 수집을 시작합니다.");

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = formatInTimeZone(yesterday, 'Asia/Seoul', 'yyyy-MM-dd');

  try {
    const apiConfigDoc = await db.collection('_config').doc('api_credentials').get();
    if (!apiConfigDoc.exists) {
      console.log("API 인증 정보가 없어 스킵합니다.");
      return null;
    }
    const apiConfig = apiConfigDoc.data();

    // Google Ads Customer ID를 설정에서 가져오거나 직접 입력합니다.
    const googleAdsCustomerId = apiConfig.google?.customerId || "730-978-8943"; // 예시 ID

    // 각 API를 병렬로 호출하여 광고비 가져오기
    const [tiktokCost, googleAdsCost] = await Promise.all([
      fetchTiktokSpend(apiConfig.tiktok, yesterday),
      fetchGoogleAdsSpend(apiConfig.google, googleAdsCustomerId, yesterday)
    ]);

    // Firestore 'ad_costs' 컬렉션에 저장하기
    if (tiktokCost > 0 || googleAdsCost > 0) {
      const docRef = db.collection(AD_COSTS).doc(dateStr);
      await docRef.set({
        tiktok: tiktokCost,
        google: googleAdsCost,
      }, { merge: true });
      console.log(`${dateStr}의 광고비 수집 완료: TikTok: ${tiktokCost}, Google: ${googleAdsCost}`);
    } else {
      console.log(`${dateStr}에 수집된 광고비가 없습니다.`);
    }

  } catch (error) {
    console.error("광고비 자동 수집 중 오류 발생:", error);
  }

  return null;
});