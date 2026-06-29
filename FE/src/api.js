const API_BASE = "http://localhost:8000";

export async function analyzeStock(ticker) {
  const res = await fetch(`${API_BASE}/api/analyze?ticker=${encodeURIComponent(ticker)}`);
  if (!res.ok) throw new Error(`분석 요청 실패: ${res.status}`);
  return res.json();
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
