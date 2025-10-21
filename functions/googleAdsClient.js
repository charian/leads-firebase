// charian/leads-firebase/leads-firebase-055a667c5c853ad85aee2ec7f79d21492d3b2ea1/functions/googleAdsClient.js (신규 파일)

const { GoogleAdsApi } = require("google-ads-api");
const { formatInTimeZone } = require("date-fns-tz");

async function fetchGoogleAdsSpend(credentials, customerId, date) {
  if (!credentials || !customerId) {
    console.log("Google Ads 인증 정보 또는 고객 ID가 없어 스킵합니다.");
    return 0;
  }

  try {
    // 1. Google Ads API 클라이언트 초기화
    const client = new GoogleAdsApi({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      developer_token: credentials.developerToken,
    });

    // 2. 특정 광고 계정(customer)에 연결
    const customer = client.Customer({
      customer_id: customerId, // 실제 광고 데이터가 있는 계정 ID
      login_customer_id: customerId, // MCC 계정인 경우 관리자 계정 ID, 아니면 위와 동일
      refresh_token: credentials.refreshToken,
    });

    const dateStr = formatInTimeZone(date, 'Asia/Seoul', 'yyyy-MM-dd');

    // 3. GAQL 쿼리를 사용하여 특정 날짜의 광고비 조회
    const results = await customer.query(`
            SELECT metrics.cost_micros
            FROM campaign
            WHERE segments.date = '${dateStr}'
        `);

    // 4. 결과 합산 및 반환 (micros 단위를 일반 통화 단위로 변경)
    const totalCostMicros = results.reduce((sum, row) => sum + (row.metrics.cost_micros || 0), 0);
    return totalCostMicros / 1000000;

  } catch (error) {
    console.error("Google Ads 광고비 조회 실패:", error);
    return 0;
  }
}

module.exports = { fetchGoogleAdsSpend };