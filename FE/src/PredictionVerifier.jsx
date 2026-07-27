import React, { useState } from 'react';

const API_BASE = 'http://localhost:8000';

function PredictionVerifier({ ticker, record }) {
  const [actual, setActual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const isKRW = ticker?.includes('.KS') || ticker?.includes('.KQ');
  const fmt = (v) => v != null ? (isKRW ? `${Math.round(v).toLocaleString()}원` : `$${v}`) : '-';

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    return dateStr.replace(/\s/g, '').replace(/\./g, '-').replace(/-$/, '');
  };

  const fetchActualPrice = async () => {
    if (fetched || loading) return;
    setLoading(true);
    try {
      const dateStr = parseDate(record.date);
      if (!dateStr) return;
      const res = await fetch(`${API_BASE}/api/actual-price?ticker=${ticker}&date=${dateStr}`);
      const data = await res.json();
      setActual(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const getResult = () => {
    if (!actual?.actual_price) return null;
    const price = actual.actual_price;
    const inRange = price >= record.lower && price <= record.upper;
    const error = ((price - record.predictedPrice) / record.predictedPrice * 100).toFixed(1);
    const direction = price >= record.currentPrice ? '상승' : '하락';
    const predictedDirection = record.predictedPrice >= record.currentPrice ? '상승' : '하락';
    const directionMatch = direction === predictedDirection;
    return { price, inRange, error, direction, directionMatch };
  };

  const result = actual ? getResult() : null;

  return (
    <div style={{ marginTop: 10 }}>
      {!fetched ? (
        <button onClick={fetchActualPrice}
          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280', fontWeight: 500 }}>
          {loading ? '조회 중...' : '📊 실제 종가 확인'}
        </button>
      ) : result ? (
        <div style={{ background: result.inRange ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '10px 14px', border: `1px solid ${result.inRange ? '#bbf7d0' : '#fecaca'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: result.inRange ? '#16a34a' : '#dc2626' }}>
              {result.inRange ? '✅ 구간 적중' : '❌ 구간 이탈'}
            </span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{actual.actual_date} 종가</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px' }}>
              <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>실제 종가</p>
              <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: '#111827' }}>{fmt(result.price)}</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px' }}>
              <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>예측 오차</p>
              <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: Math.abs(parseFloat(result.error)) < 3 ? '#10B981' : '#F59E0B' }}>
                {result.error > 0 ? '+' : ''}{result.error}%
              </p>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: result.directionMatch ? '#dcfce7' : '#fee2e2', color: result.directionMatch ? '#16a34a' : '#dc2626' }}>
              방향 {result.directionMatch ? '✅ 적중' : '❌ 이탈'} ({result.direction})
            </span>
            <span style={{ fontSize: 11, color: '#6b7280' }}>
              예측 구간: {fmt(record.lower)} ~ {fmt(record.upper)}
            </span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: '#9ca3af' }}>실제 종가 조회 실패</p>
      )}
    </div>
  );
}

export default PredictionVerifier;