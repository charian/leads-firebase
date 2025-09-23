import { collection, getDocs, orderBy, query, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Lead } from "../types";

/**
 * Firestore의 'leads' 컬렉션에서 모든 문서를 가져와 날짜 내림차순으로 정렬합니다.
 */
export async function fetchLeads(): Promise<Lead[]> {
  try {
    const leadsCollection = collection(db, "leads");
    // 'createdAt' 필드를 기준으로 내림차순 정렬합니다.
    const q = query(leadsCollection, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const leads: Lead[] = [];
    querySnapshot.forEach((doc) => {
      // 문서 데이터와 문서 ID를 함께 객체로 만듭니다.
      leads.push({ id: doc.id, ...doc.data() } as Lead);
    });
    return leads;
  } catch (error) {
    console.error("Error fetching leads: ", error);
    return []; // 오류 발생 시 빈 배열 반환
  }
}

/**
 * ✨ 추가: 특정 리드의 메모 필드를 업데이트하는 함수입니다.
 * 이 함수를 export 해야 App.tsx에서 사용할 수 있습니다.
 * @param leadId 업데이트할 리드의 문서 ID
 * @param memo 저장할 새로운 메모 내용
 */
export async function updateLeadMemo(leadId: string, memo: string): Promise<void> {
  try {
    const leadRef = doc(db, "leads", leadId);
    await updateDoc(leadRef, { memo });
  } catch (error) {
    console.error("Error updating memo: ", error);
    throw error; // 오류 발생 시 상위로 전파하여 UI에서 처리할 수 있도록 함
  }
}
