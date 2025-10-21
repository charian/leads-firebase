// charian/leads-firebase/leads-firebase-055a667c5c853ad85aee2ec7f79d21492d3b2ea1/admin-ui/src/services/apiSettings.ts (신규 파일)

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// API 설정 정보 불러오기
export async function getApiSettings() {
  const fn = httpsCallable(functions, "getApiSettings");
  const result = await fn();
  return result.data;
}

// API 설정 정보 저장하기
export async function saveApiSettings(settings: { tiktok: any; google: any }) {
  const fn = httpsCallable(functions, "saveApiSettings");
  await fn(settings);
}
