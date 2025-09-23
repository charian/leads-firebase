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

// ✨ 수정: oldMemo 인자를 추가로 받도록 함수 정의를 변경합니다.
export async function updateLeadMemo(leadId: string, memo: string, oldMemo: string) {
  const updateMemo = httpsCallable(functions, "updateMemoAndLog");
  await updateMemo({ leadId, memo, oldMemo });
}

export async function setLeadBadStatus(leadId: string, isBad: boolean) {
  const leadRef = doc(db, "leads", leadId);
  await updateDoc(leadRef, { isBad });
}
