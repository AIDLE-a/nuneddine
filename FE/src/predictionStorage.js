// FE/src/predictionStorage.js
// 예측 기록 조회/검증 유틸리티 — 백엔드(prediction_records/*.json)와 통신
// 저장은 /api/analyze 호출 시 서버가 자동 처리, 여기선 조회 + 검증 요청만 담당

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export async function loadPredictions(ticker) {
  try {
    const res = await fetch(`${API_BASE}/api/prediction-records/${ticker}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || [];
  } catch (e) {
    console.warn('예측 기록 조회 실패:', e);
    return [];
  }
}

export async function loadAllPredictions() {
  try {
    const res = await fetch(`${API_BASE}/api/prediction-records`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => ({
      ticker: r.ticker,
      name: r.name,
      recordCount: r.record_count,
      lastDate: r.last_updated || '',
    })).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  } catch (e) {
    console.warn('전체 예측 기록 조회 실패:', e);
    return [];
  }
}

// 기록실 '검증' 버튼이 호출 — 즉석으로 실제값 조회 + 서버에 결과 저장
export async function verifyPrediction(ticker, runDate, horizon = 'd1') {
  try {
    const params = new URLSearchParams({ ticker, run_date: runDate, horizon });
    const res = await fetch(`${API_BASE}/api/verify-prediction?${params}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '검증 실패');
    }
    return await res.json();
  } catch (e) {
    console.warn('예측 검증 실패:', e);
    throw e;
  }
}