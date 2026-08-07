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
        <button onClick={fetchActualPrice} className="btn-secondary" style={{ fontSize: 11 }}>
          {loading ? '조회 중...' : '실제 종가 확인'}
        </button>
      ) : result ? (
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: result.inRange ? 'var(--positive)' : 'var(--negative)' }}>
              {result.inRange ? '구간 적중' : '구간 이탈'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{actual.actual_date} 종가</span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: 12 }}>
            <div style={{
              width: result.inRange ? '100%' : `${Math.min(100, Math.max(0, 100 - Math.abs(parseFloat(result.error)) * 5))}%`,
              background: result.inRange ? 'var(--positive)' : 'var(--negative)',
              height: 6, borderRadius: 4,
            }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>실제 종가</p>
              <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(result.price)}</p>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 10px' }}>
              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>예측 오차</p>
              <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: Math.abs(parseFloat(result.error)) < 3 ? 'var(--positive)' : '#F59E0B' }}>
                {result.error > 0 ? '+' : ''}{result.error}%
              </p>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 8,
              background: result.directionMatch ? 'var(--accent-bg)' : '#fee2e2',
              color: result.directionMatch ? 'var(--accent)' : 'var(--negative)',
            }}>
              방향 {result.directionMatch ? '적중' : '이탈'} ({result.direction})
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              예측 구간: {fmt(record.lower)} ~ {fmt(record.upper)}
            </span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>실제 종가 조회 실패</p>
      )}
    </div>
  );
}

export default PredictionVerifier;
