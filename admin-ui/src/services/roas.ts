// charian/leads-firebase/leads-firebase-055a667c5c853ad85aee2ec7f79d21492d3b2ea1/admin-ui/src/services/roas.ts (신규 파일)
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// ROAS 분석 데이터 요청 함수 (추후 구현)
export async function getRoasData(startDate: Date, endDate: Date) {
  const fn = httpsCallable(functions, "getRoasData");
  const result = await fn({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  return result.data;
}

// 광고비 저장 함수 (추후 구현)
export async function setAdCost(date: string, source: string, cost: number) {
  const fn = httpsCallable(functions, "setAdCost");
  await fn({ date, source, cost });
}
