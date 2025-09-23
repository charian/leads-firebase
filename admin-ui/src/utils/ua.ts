export function parseUA(ua?: string) {
  if (!ua) return { platform: "-", browser: "-" };
  let platform = "-",
    browser = "-";
  if (/Macintosh/i.test(ua)) {
    const m = /Mac OS X ([\d_]+)/i.exec(ua);
    platform = "Mac OS X " + (m ? m[1].replace(/_/g, ".") : "");
  } else if (/Windows NT/i.test(ua)) {
    const w = /Windows NT ([\d.]+)/i.exec(ua);
    platform = "Windows " + (w ? w[1] : "");
  } else if (/Android/i.test(ua)) platform = "Android";
  else if (/iPhone|iPad/i.test(ua)) platform = "iOS";
  else if (/Linux/i.test(ua)) platform = "Linux";

  if (/Edg\//i.test(ua)) {
    const c = /Edg\/([\d.]+)/i.exec(ua);
    browser = "Edge" + (c ? " " + c[1] : "");
  } else if (/Chrome\//i.test(ua)) {
    const c = /Chrome\/([\d.]+)/i.exec(ua);
    browser = "Chrome" + (c ? " " + c[1] : "");
  } else if (/Firefox\//i.test(ua)) {
    const f = /Firefox\/([\d.]+)/i.exec(ua);
    browser = "Firefox" + (f ? " " + f[1] : "");
  } else if (/Safari\//i.test(ua)) {
    const s = /Version\/([\d.]+)/i.exec(ua);
    browser = "Safari" + (s ? " " + s[1] : "");
  }
  return { platform, browser };
}
