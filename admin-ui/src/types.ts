import { Timestamp } from "firebase/firestore";

/**
 * Firestore에 저장되는 리드 데이터의 타입 구조입니다.
 */
export interface Lead {
  id: string; // Firestore 문서 ID
  name: string;
  phone_raw: string;
  phone_e164: string;
  region_key: "metro" | "non_metro";
  region_ko: "수도권" | "비수도권";
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  page: string;
  userAgent: string;
  createdAt: Timestamp; // Firebase의 Timestamp 타입
  download: number;
  location?: string;
  // ✨ 추가: memo 필드를 optional로 명시합니다.
  memo?: string;
}

/**
 * 필터링 UI의 상태를 정의하는 타입입니다.
 */
export interface Filters {
  dl: "no" | "all";
  name: string;
  phone: string;
  source: string;
  period: "" | "오전" | "오후";
}
