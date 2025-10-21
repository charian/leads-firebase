// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/types.ts

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

  // ✨ 추가: 내원 및 시술 여부 필드
  visited?: boolean;
  procedure?: boolean;

  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  ga_client_id?: string;

  // ✨ 추가: IP 및 도시 정보 필드
  ipAddress?: string;
  ipCity?: string;

  [key: string]: any;
}

export interface Admin {
  email: string;
  role: "super-admin" | "admin" | "user";
  notifyOnNewLead: boolean;
  notifyOnDailySummary: boolean;
}

export interface Filters {
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
  leadName?: string;
  leadPhone?: string;
}

export interface TrendDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface AdvancedStats {
  yesterday: {
    total: number;
    bad: number;
    bySource: { [key: string]: number };
  };
  today: {
    total: number;
    bad: number;
    bySource: { [key: string]: number };
  };
  trend: TrendDataPoint[];
  cumulativeTotal: number;
  sources: string[];
  cumulativeBySource: { [key: string]: number };
}

export interface AdCost {
  source: number;
}

export interface RoasData {
  date: string;
  source: string;
  cost: number;
  leads: number;
  revenue: number;
  roas: number;
}
