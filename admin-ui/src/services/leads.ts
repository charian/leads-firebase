import { db } from "./firebase";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import type { Lead } from "../types";

/**
 * Firestore 'leads' 컬렉션의 모든 문서를 가져옵니다.
 * 문서는 생성된 시간의 내림차순으로 정렬됩니다.
 */
export async function fetchLeads(): Promise<Lead[]> {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Lead[];
}

/**
 * 특정 리드의 메모를 업데이트합니다.
 * @param leadId - 업데이트할 리드의 문서 ID
 * @param memo - 새로운 메모 내용
 */
export async function updateLeadMemo(leadId: string, memo: string): Promise<void> {
  const leadRef = doc(db, "leads", leadId);
  await updateDoc(leadRef, { memo });
}

/**
 * ✨ 추가: 특정 리드의 '불량' 상태를 업데이트합니다.
 * @param leadId - 업데이트할 리드의 문서 ID
 * @param isBad - 새로운 불량 상태 (true/false)
 */
export async function setLeadBadStatus(leadId: string, isBad: boolean): Promise<void> {
  const leadRef = doc(db, "leads", leadId);
  await updateDoc(leadRef, { isBad });
}
