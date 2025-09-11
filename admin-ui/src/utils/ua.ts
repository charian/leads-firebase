export function parseUA(ua?: string) {
  if (!ua) return { platform: "-", browser: "-" };
  let platform = "-",
    browser = "-";
  if (/Macintosh/i.test(ua)) {
    const m = /Mac OS X ([\d_]+)/i.exec(ua);
    platform = "PC (Mac OS X " + (m ? m[1].replace(/_/g, ".") : "") + ")";
  } else if (/Windows NT/i.test(ua)) {
    const w = /Windows NT ([\d.]+)/i.exec(ua);
    platform = "PC (Windows " + (w ? w[1] : "") + ")";
  } else if (/Android/i.test(ua)) platform = "Android";
  else if (/iPhone|iPad/i.test(ua)) platform = "iOS";

  if (/Chrome\//i.test(ua)) {
    const c = /Chrome\/([\d.]+)/i.exec(ua);
    browser = "Chrome" + (c ? " " + c[1] : "");
  } else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  return { platform, browser };
}
