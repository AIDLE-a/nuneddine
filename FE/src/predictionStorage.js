// FE/src/predictionStorage.js
// 예측 기록 localStorage 유틸리티 — AiReportCard, HistoryPage에서 공통 사용

const PRED_KEY = 'nuneddine_predictions';

export function savePrediction(ticker, stockName, record) {
  try {
    const all = JSON.parse(localStorage.getItem(PRED_KEY) || '{}');
    if (!all[ticker]) all[ticker] = { name: stockName, records: [] };
    all[ticker].records = [
      record,
      ...all[ticker].records.filter(r => r.date !== record.date)
    ].slice(0, 365);
    all[ticker].name = stockName;
    localStorage.setItem(PRED_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('예측 기록 저장 실패:', e);
  }
}

export function loadPredictions(ticker) {
  try {
    const all = JSON.parse(localStorage.getItem(PRED_KEY) || '{}');
    return all[ticker]?.records || [];
  } catch (e) { return []; }
}

export function loadAllPredictions() {
  try {
    const all = JSON.parse(localStorage.getItem(PRED_KEY) || '{}');
    return Object.entries(all).map(([ticker, data]) => ({
      ticker,
      name: data.name,
      records: data.records || [],
      lastDate: data.records?.[0]?.date || '',
    })).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  } catch (e) { return []; }
}

export function deletePredictionRecord(ticker, date) {
  try {
    const all = JSON.parse(localStorage.getItem(PRED_KEY) || '{}');
    if (!all[ticker]) return;
    all[ticker].records = all[ticker].records.filter(r => r.date !== date);
    localStorage.setItem(PRED_KEY, JSON.stringify(all));
  } catch (e) {}
}