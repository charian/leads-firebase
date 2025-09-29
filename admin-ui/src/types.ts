import type { Dayjs } from "dayjs";
import { Timestamp } from "firebase/firestore";

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
  [key: string]: any; // for utm_source etc.
}

export interface Admin {
  email: string;
  role: "super-admin" | "admin" | "user";
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

// ✨ 수정: 프로젝트 전체에서 사용할 유일한 AdvancedStats 타입 정의
export interface AdvancedStats {
  cumulativeTotal: number;
  yesterday: {
    total: number;
    bad: number;
    bySource: Record<string, number>;
  };
  today: {
    total: number;
    bad: number;
    bySource: Record<string, number>;
  };
  // 매체별 누적 차트를 위한 데이터 구조
  trend: ({
    date: string;
  } & Record<string, number>)[];
}
