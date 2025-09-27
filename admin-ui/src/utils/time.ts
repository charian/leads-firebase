import { Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Day.js에 플러그인을 추가하여 시간대 기능을 활성화합니다.
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 다양한 타입의 값을 JavaScript Date 객체로 변환합니다.
 * @param val Firestore Timestamp, Date 객체, 문자열, 숫자 등
 * @returns Date 객체 또는 null
 */
export function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Date 객체를 'YYYY-MM-DD HH:mm' 형식의 한국 시간(KST) 문자열로 변환합니다.
 * @param createdAt Firestore Timestamp 또는 Date 객체
 * @returns 포맷된 날짜 문자열
 */
export function formatKSTCompact(createdAt: any): string {
  const d = toDate(createdAt);
  if (!d) return "";
  // ✨ 수정: dayjs를 사용하여 Firestore 시간을 한국 시간으로 올바르게 포맷합니다.
  return dayjs(d).tz("Asia/Seoul").format("YYYY-MM-DD HH:mm");
}

/**
 * Date 객체를 한국 시간(KST) 기준으로 더 상세한 정보로 분해합니다.
 * @param createdAt Firestore Timestamp 또는 Date 객체
 * @returns 날짜, 시간, 오전/오후 정보가 담긴 객체
 */
export function formatKST(createdAt: any) {
  const d = toDate(createdAt);
  if (!d) return { date: "-", time: "-", period: "-", kst: null };

  const kstDayjs = dayjs(d).tz("Asia/Seoul");

  return {
    date: kstDayjs.format("YYYY년 M월 D일"),
    time: kstDayjs.format("A h시 m분"),
    period: kstDayjs.format("A") === "AM" ? "오전" : "오후",
    kst: d,
  };
}
