export function parseUA(ua?: string) {
  if (!ua) return { platform: "-", browser: "-" };
  let platform = "-",
    browser = "-";

  // Platform detection
  if (/Macintosh/i.test(ua)) {
    const m = /Mac OS X ([\d_]+)/i.exec(ua);
    platform = "Mac OS X " + (m ? m[1].replace(/_/g, ".") : "");
  } else if (/Windows NT/i.test(ua)) {
    const w = /Windows NT ([\d.]+)/i.exec(ua);
    let winVersion = w ? w[1] : "";
    if (winVersion === "10.0") winVersion = "10/11";
    platform = "Windows " + winVersion;
  } else if (/Android/i.test(ua)) {
    const a = /Android ([\d.]+)/i.exec(ua);
    platform = "Android" + (a ? ` ${a[1]}` : "");
  } else if (/iPhone|iPad/i.test(ua)) {
    const i = /OS ([\d_]+) like Mac OS X/i.exec(ua);
    platform = "iOS " + (i ? i[1].replace(/_/g, ".") : "");
  } else if (/Linux/i.test(ua)) {
    platform = "Linux";
  }

  // Browser detection
  if (/Edg\//i.test(ua)) {
    const e = /Edg\/([\d.]+)/i.exec(ua);
    browser = "Edge " + (e ? e[1] : "");
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    const c = /Chrome\/([\d.]+)/i.exec(ua);
    browser = "Chrome " + (c ? c[1] : "");
  } else if (/Firefox\//i.test(ua)) {
    const f = /Firefox\/([\d.]+)/i.exec(ua);
    browser = "Firefox " + (f ? f[1] : "");
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    const s = /Version\/([\d.]+)/i.exec(ua);
    browser = "Safari " + (s ? s[1] : "");
  }

  return { platform, browser };
}
