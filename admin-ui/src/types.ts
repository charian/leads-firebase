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
  visited?: boolean;
  procedure?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  ga_client_id?: string;
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

export interface RoasData {
  date: string;
  source: string;
  cost: number;
  leads: number;
  revenue: number;
  roas: number;
}

// ROAS 페이지를 위한 타입들
export interface CoreMetrics {
  cumulativeCostPerLead: number;
  thisWeekCostPerLead: number;
  thisMonthCostPerLead: number;
  costPerLeadBySource: { [key: string]: number };
  adSpendBySource: { [key: string]: number };
  leadsBySource: { [key: string]: number }; // ✨ 추가
}

export interface RoasPageData {
  roasData: RoasData[];
  trendData: TrendDataPoint[];
  trendSources: string[];
  coreMetrics: CoreMetrics;
}
