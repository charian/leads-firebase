import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { AdvancedStats } from "../types";

// onCall: createLeadCall
export async function createLeadCall(data: any) {
  const fn = httpsCallable(functions, "createLeadCall");
  const res = await fn(data);
  return res.data;
}

// onCall: incrementDownloads
export async function incrementDownloadsCall(ids: string[]) {
  const fn = httpsCallable(functions, "incrementDownloads");
  const res = await fn({ ids });
  return res.data as { updated: number };
}

// onCall: deleteLeads
export async function deleteLeadsCall(ids: string[]) {
  const fn = httpsCallable(functions, "deleteLeads");
  const res = await fn({ ids });
  return res.data as { deleted: number };
}

// ✨ 추가: 대시보드 통계 Cloud Function 호출
export async function getAdvancedDashboardStats() {
  const fn = httpsCallable(functions, "getAdvancedDashboardStats");
  const res = await fn();
  return res.data as AdvancedStats;
}
