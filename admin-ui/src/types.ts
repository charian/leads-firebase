import type { Dayjs } from "dayjs";
import type { Timestamp } from "firebase/firestore";

export interface Lead {
  id: string;
  name: string;
  phone_raw: string;
  phone_e164: string;
  region_ko: string;
  createdAt: Timestamp;
  download: number;
  downloadedAt?: Timestamp;
  downloadedBy?: string;
  isBad: boolean;
  memo: string;
  [key: string]: any;
}

export interface Admin {
  email: string;
  role: "super-admin" | "admin" | "user";
}

export interface Filters {
  // ✨ 수정: RangePicker가 null을 반환할 수 있도록 | null을 추가합니다.
  dateRange: [Dayjs | null, Dayjs | null] | null;
  status: "all" | "good" | "bad";
  dl: "all" | "yes" | "no";
  name: string;
  phone: string;
}

export interface SettlementCost {
  [year: string]: number;
}

export interface HistoryLog {
  id: string;
  action: "DOWNLOAD" | "DELETE" | "UPDATE_MEMO";
  userEmail: string;
  leadId: string;
  timestamp: Timestamp;
  from?: string;
  to?: string;
}
