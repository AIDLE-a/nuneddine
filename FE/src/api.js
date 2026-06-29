const API_BASE = "http://localhost:8000";

export async function analyzeStock(ticker) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2분 타임아웃
  try {
    const res = await fetch(`${API_BASE}/api/analyze?ticker=${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`분석 요청 실패: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRelatedStocks(ticker) {
  try {
    const res = await fetch(`${API_BASE}/api/related?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function searchStocks(query) {
  try {
    const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function loginWithToken(idToken) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
  });
  if (!res.ok) throw new Error("백엔드 로그인 실패");
  return res.json();
}
