import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Admin } from "../types";

// ✨ 추가: "내 등급 확인" 전용 함수 호출
export async function getMyRoleCall(): Promise<{ email: string; role: "super-admin" | "admin" | "user" | null }> {
  const fn = httpsCallable(functions, "getMyRole");
  const res = await fn();
  return res.data as { email: string; role: "super-admin" | "admin" | "user" | null };
}

export async function getAdminsCall(): Promise<Admin[]> {
  const fn = httpsCallable(functions, "getAdmins");
  const res = await fn();
  return res.data as Admin[];
}

export async function addAdminCall(email: string, role: "admin" | "user"): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "addAdmin");
  const res = await fn({ email, role });
  return res.data as { ok: boolean };
}

export async function updateAdminRoleCall(email: string, role: "admin" | "user"): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "updateAdminRole");
  const res = await fn({ email, role });
  return res.data as { ok: boolean };
}

export async function removeAdminCall(email: string): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "removeAdmin");
  const res = await fn({ email });
  return res.data as { ok: boolean };
}
