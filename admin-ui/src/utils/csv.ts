import { formatKST } from "./time";
import type { Lead } from "../types";

export function leadsToCsv(rows: Lead[]): string {
  // ✨ 요청하신 대로 CSV 헤더를 수정합니다.
  const headers = [
    "이름",
    "전화번호",
    "지역",
    "불량여부",
    "추가시간",
    "유입매체", // utm_source
  ];

  const lines = [headers.join(",")].concat(
    rows.map((r) => {
      // ✨ 요청하신 데이터 형식에 맞게 객체를 구성합니다.
      const { date, time } = formatKST(r.createdAt);
      const obj = {
        name: r.name ?? "",
        phone: r.phone_raw ?? "",
        location: r.region_ko ?? "",
        isBad: r.isBad ? "Y" : "N",
        createdAt: `${date} ${time}`,
        source: r.utm_source ?? "",
      };

      // 각 값을 CSV 형식에 맞게 변환합니다.
      return Object.values(obj)
        .map((v) => {
          const s = String(v ?? "").replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",");
    })
  );

  // BOM을 추가하여 Excel에서 한글이 깨지지 않도록 합니다.
  return "\uFEFF" + lines.join("\n");
}
