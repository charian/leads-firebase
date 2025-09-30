import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Admin } from "../types";

// ✨ 수정: getMyRoleCall 함수는 더 이상 필요 없으므로 삭제합니다.

// ✨ 수정: 로그인 시 Firestore에서 직접 역할을 가져오는 함수
export async function getMyRoleFromFirestore(email: string): Promise<Admin["role"] | null> {
  const docRef = doc(db, "_config", "admins");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const roles = docSnap.data().roles || {};
    return roles[email] || null;
  }
  return null;
}

export async function getAdminsCall(): Promise<Admin[]> {
  const fn = httpsCallable(functions, "getAdmins");
  const res = await fn();
  return res.data as Admin[];
}

export async function addAdminCall(email: string, role: "admin" | "user") {
  const fn = httpsCallable(functions, "addAdmin");
  await fn({ email, role });
}

export async function updateAdminRoleCall(email: string, role: "admin" | "user") {
  const fn = httpsCallable(functions, "updateAdminRole");
  await fn({ email, role });
}

export async function removeAdminCall(email: string) {
  const fn = httpsCallable(functions, "removeAdmin");
  await fn({ email });
}

export async function updateAdminNotificationsCall(email: string, field: "notifyOnNewLead" | "notifyOnDailySummary", value: boolean) {
  const fn = httpsCallable(functions, "updateAdminNotifications");
  await fn({ email, field, value });
}
