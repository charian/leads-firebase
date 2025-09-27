/**
 * Referrer URL을 분석하여 보기 쉬운 이름과 색상을 반환합니다.
 * @param referrer - document.referrer 값
 * @returns { name: string, color: string }
 */
export function parseReferrer(referrer?: string) {
  if (!referrer) {
    return { name: "Direct", color: "geekblue" };
  }

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase().replace("www.", "");

    // 주요 검색 엔진
    if (hostname.includes("google.")) return { name: "Google", color: "gold" };
    if (hostname.includes("naver.com")) return { name: "Naver", color: "green" };
    if (hostname.includes("daum.net")) return { name: "Daum", color: "blue" };
    if (hostname.includes("bing.com")) return { name: "Bing", color: "cyan" };
    if (hostname.includes("duckduckgo.com")) return { name: "DuckDuckGo", color: "orange" };

    // 주요 소셜 미디어 및 기타 플랫폼
    if (hostname.includes("facebook.com")) return { name: "Facebook", color: "#3b5998" };
    if (hostname.includes("instagram.com")) return { name: "Instagram", color: "#e4405f" };
    if (hostname.includes("x.com") || hostname.includes("twitter.com")) return { name: "X (Twitter)", color: "#1da1f2" };
    if (hostname.includes("linkedin.com")) return { name: "LinkedIn", color: "#0077b5" };
    if (hostname.includes("t.co")) return { name: "X (Twitter)", color: "#1da1f2" };
    if (hostname.includes("tiktok.com")) return { name: "TikTok", color: "#ff0050" };
    if (hostname.includes("daangn.com")) return { name: "Karrot (당근)", color: "#ff6f0f" };

    // 그 외에는 호스트네임만 반환
    return { name: hostname, color: "default" };
  } catch (e) {
    // URL 파싱 실패 시 원본 문자열 반환
    return { name: referrer, color: "default" };
  }
}
