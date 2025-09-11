export function toDate(val: any): Date | null {
  if (val?.toDate) return val.toDate();
  if (typeof val === "string") return new Date(val);
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  return null;
}

export function formatKST(createdAt: any) {
  const d = toDate(createdAt);
  if (!d || isNaN(d as any)) return { date: "-", time: "-", period: "-", kst: null as Date | null };
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = k.getFullYear(),
    m = k.getMonth() + 1,
    dd = k.getDate();
  const mm = String(k.getMinutes()).padStart(2, "0");
  const h24 = k.getHours(),
    period = h24 < 12 ? "오전" : "오후",
    h12 = h24 % 12 || 12;
  return { date: `${y}년 ${m}월 ${dd}일`, time: `${period} ${h12}시 ${mm}분`, period, kst: k };
}

export function formatKSTCompact(createdAt: any) {
  const { kst } = formatKST(createdAt);
  if (!kst) return "";
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  const hh = String(kst.getHours()).padStart(2, "0");
  const mm = String(kst.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}
