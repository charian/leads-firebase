import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

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
