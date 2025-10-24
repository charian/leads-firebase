import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { Admin } from "../types";

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
