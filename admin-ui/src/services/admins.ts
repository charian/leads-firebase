import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// 운영자 목록 가져오기
export async function getAdminsCall(): Promise<string[]> {
  const fn = httpsCallable(functions, "getAdmins");
  const res = await fn();
  return res.data as string[];
}

// 운영자 추가
export async function addAdminCall(email: string) {
  const fn = httpsCallable(functions, "addAdmin");
  await fn({ email });
}

// 운영자 삭제
export async function removeAdminCall(email: string) {
  const fn = httpsCallable(functions, "removeAdmin");
  await fn({ email });
}
