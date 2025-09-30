// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/services/leads.ts

import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import type { Lead } from "../types";

export async function fetchLeads(): Promise<Lead[]> {
  const querySnapshot = await getDocs(collection(db, "leads"));
  const leads: Lead[] = [];
  querySnapshot.forEach((doc) => {
    leads.push({ id: doc.id, ...doc.data() } as Lead);
  });
  // 최신순으로 정렬
  return leads.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function updateLeadMemo(leadId: string, memo: string, oldMemo: string) {
  const updateMemo = httpsCallable(functions, "updateMemoAndLog");
  await updateMemo({ leadId, memo, oldMemo });
}

// ✨ 수정: 범용 상태 업데이트 함수 호출
export async function setLeadStatus(leadId: string, field: "isBad" | "visited" | "procedure", status: boolean) {
  const fn = httpsCallable(functions, "setLeadStatus");
  await fn({ leadId, field, status });
}
