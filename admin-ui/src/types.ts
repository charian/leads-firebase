import { Dayjs } from "dayjs";

export type Lead = {
  id: string;
  name: string;
  phone_raw: string;
  phone_e164: string;
  region_ko: string;
  region_key: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  page?: string;
  userAgent?: string;
  createdAt: any; // Firestore Timestamp
  download: number;
  memo?: string;
  isBad?: boolean;
  downloadedAt?: any; // Firestore Timestamp
  downloadedBy?: string;
};

export type Filters = {
  // ✨ 수정: RangePicker가 null 값을 가질 수 있도록 타입을 수정합니다.
  dateRange: [Dayjs | null, Dayjs | null] | null;
  status: "all" | "good" | "bad";
  dl: "all" | "yes" | "no";
  name: string;
  phone: string;
};

export type Admin = {
  email: string;
  role: "super-admin" | "admin" | "user";
};
