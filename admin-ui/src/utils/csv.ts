import { formatKST, formatKSTCompact } from "./time";
import { parseUA } from "./ua";
import type { Lead } from "../types";

export function leadsToCsv(rows: Lead[]): string {
  const headers = [
    "name",
    "phone_e164",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "page",
    "location",
    "period",
    "Platform",
    "Browser",
    "createdAt(KST)",
    "createdAt_compact",
    "download",
    "id",
  ];
  const lines = [headers.join(",")].concat(
    rows.map((r) => {
      const { date, time, period } = formatKST(r.createdAt);
      const { platform, browser } = parseUA(r.userAgent);
      const obj = {
        name: r.name ?? "",
        phone_e164: r.phone_e164 ?? "",
        referrer: r.referrer ?? "",
        utm_source: r.utm_source ?? "",
        utm_medium: r.utm_medium ?? "",
        utm_campaign: r.utm_campaign ?? "",
        page: r.page ?? "",
        location: r.location ?? "",
        period,
        Platform: platform,
        Browser: browser,
        "createdAt(KST)": `${date} ${time}`,
        createdAt_compact: formatKSTCompact(r.createdAt),
        download: Number(r.download ?? 0),
        id: r.id,
      };
      return Object.values(obj)
        .map((v) => {
          const s = String(v ?? "").replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",");
    })
  );
  return lines.join("\n");
}
