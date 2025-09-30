// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/services/functions.ts

import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { AdvancedStats } from "../types";

// onCall: createLeadCall (변경 없음)
export async function createLeadCall(data: any) {
  const fn = httpsCallable(functions, "createLeadCall");
  const res = await fn(data);
  return res.data;
}

// onCall: incrementDownloads (변경 없음)
export async function incrementDownloadsCall(ids: string[]) {
  const fn = httpsCallable(functions, "incrementDownloads");
  const res = await fn({ ids });
  return res.data as { updated: number };
}

// ✨ 추가: 리드 삭제 Cloud Function 호출
export async function deleteLeadsCall(ids: string[]) {
  const fn = httpsCallable(functions, "deleteLeads");
  const res = await fn({ ids });
  return res.data as { deleted: number };
}

// ✨ 추가: 대시보드 통계 데이터 호출
export async function getAdvancedDashboardStatsCall(): Promise<AdvancedStats> {
  const fn = httpsCallable(functions, "getAdvancedDashboardStats");
  const res = await fn();
  return res.data as AdvancedStats;
}
