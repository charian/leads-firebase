import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import type { HistoryLog } from "../types";

export async function getHistory(): Promise<HistoryLog[]> {
  const fn = httpsCallable(functions, "getHistory");
  const res = await fn({ limit: 100 }); // 최근 100개 히스토리
  return res.data as HistoryLog[];
}
