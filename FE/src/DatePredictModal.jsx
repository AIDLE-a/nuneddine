import React, { useState } from 'react';

const API_BASE = 'http://localhost:8000';

function DatePredictModal({ stock, analysis }) {
  const [show, setShow] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!stock?.code || !analysis) return null;

  const isKRW = stock.code?.includes('.KS') || stock.code?.includes('.KQ');
  const fmt = (v) => v != null ? (isKRW ? `${Math.round(v).toLocaleString()}원` : `$${v}`) : '-';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const getConfLevel = (days) => {
    if (days <= 7) return { label: '높음', color: '#10B981', bg: '#f0fdf4', bar: 90 };
    if (days <= 30) return { label: '보통', color: '#F59E0B', bg: '#fffbeb', bar: 65 };
    if (days <= 90) return { label: '낮음', color: '#EF4444', bg: '#fef2f2', bar: 35 };
    return { label: '매우 낮음', color: '#991b1b', bg: '#fee2e2', bar: 15 };
  };

  const handlePredict = async () => {
    if (!targetDate) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/predict-date?ticker=${stock.code}&target_date=${targetDate}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError('예측 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const confLevel = result ? getConfLevel(result.days_ahead) : null;
  const currentPrice = analysis?.price || 0;

  // 범위 바에서 현재가/예측가 위치
  const rangePos = (v) => {
    if (!result) return 50;
    const min = result.lower * 0.98;
    const max = result.upper * 1.02;
    return Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
  };

  return (
    <>
      <button onClick={() => setShow(true)}
        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #6366f1', background: 'transparent', color: '#6366f1', cursor: 'pointer', fontWeight: 500 }}>
        📅 날짜 예측 ↗
      </button>

      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 0, width: '90%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #4f46e5)', padding: '24px 28px', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: '#a5b4fc', letterSpacing: 3, textTransform: 'uppercase' }}>AI Date Prediction</p>
                  <h2 style={{ margin: '6px 0 0', color: '#fff', fontSize: 22, fontWeight: 800 }}>미래 날짜 주가 예측</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#a5b4fc' }}>{stock.name} · 현재가 {fmt(currentPrice)}</p>
                </div>
                <button onClick={() => setShow(false)}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16 }}>✕</button>
              </div>

              {/* 날짜 선택 */}
              <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#c7d2fe', fontWeight: 600 }}>예측할 날짜 선택</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                    min={minDate} max={maxDateStr}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', fontSize: 14, outline: 'none', color: '#111827', background: '#fff' }} />
                  <button onClick={handlePredict} disabled={!targetDate || loading}
                    style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: targetDate && !loading ? '#818cf8' : 'rgba(255,255,255,0.2)', color: '#fff', cursor: targetDate && !loading ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {loading ? '예측 중...' : '예측 →'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {[{ label: '1주일', days: 7 }, { label: '1개월', days: 30 }, { label: '3개월', days: 90 }, { label: '6개월', days: 180 }].map(({ label, days }) => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const ds = d.toISOString().split('T')[0];
                    return (
                      <button key={days} onClick={() => setTargetDate(ds)}
                        style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)', background: targetDate === ds ? '#818cf8' : 'transparent', color: '#fff', cursor: 'pointer' }}>
                        {label} 후
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 본문 */}
            <div style={{ padding: '24px 28px' }}>

              {error && (
                <div style={{ background: '#fef2f2', borderRadius: 10, padding: '14px', border: '1px solid #fecaca', marginBottom: 20 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>⚠️ {error}</p>
                </div>
              )}

              {!result && !error && !loading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                  <p style={{ fontSize: 32, margin: '0 0 10px' }}>📅</p>
                  <p style={{ fontSize: 14, margin: 0 }}>날짜를 선택하고 예측하기를 눌러주세요</p>
                  <p style={{ fontSize: 12, margin: '6px 0 0', color: '#d1d5db' }}>Prophet 시계열 모델로 해당 날짜의 예측가를 계산합니다</p>
                </div>
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#6366f1' }}>
                  <p style={{ fontSize: 14 }}>Prophet 모델 예측 중...</p>
                </div>
              )}

              {result && (
                <div>
                  {/* 신뢰도 섹션 */}
                  <div style={{ background: confLevel.bg, borderRadius: 12, padding: '14px 18px', marginBottom: 20, border: `1px solid ${confLevel.color}30` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: confLevel.color }}>📊 예측 신뢰도: {confLevel.label}</span>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>{result.days_ahead}일 후 ({result.target_date})</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${confLevel.bar}%`, height: 8, borderRadius: 4, background: confLevel.color, transition: 'width 0.5s' }} />
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>날짜가 멀수록 불확실성이 높아집니다. AI 한계를 인지하고 참고용으로만 활용하세요.</p>
                  </div>

                  {/* 예측가 메인 */}
                  <div style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', borderRadius: 14, padding: '24px', marginBottom: 20, border: '1px solid #ddd6fe', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6366f1', fontWeight: 600, letterSpacing: 1 }}>AI 예측가</p>
                    <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: '#4f46e5' }}>{fmt(result.predicted_price)}</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 14px', borderRadius: 20, background: result.change_pct >= 0 ? '#dcfce7' : '#fee2e2' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: result.change_pct >= 0 ? '#16a34a' : '#dc2626' }}>
                        {result.change_pct >= 0 ? '▲' : '▼'} {Math.abs(result.change_pct)}%
                      </span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>현재가 대비</span>
                    </div>
                  </div>

                  {/* 범위 시각화 */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111827' }}>📈 예측 범위 시각화</p>
                    <div style={{ position: 'relative', height: 12, background: 'linear-gradient(90deg, #fee2e2, #fef9c3, #dcfce7)', borderRadius: 6, marginBottom: 24 }}>
                      {/* 현재가 마커 */}
                      <div style={{ position: 'absolute', left: `${rangePos(currentPrice)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: '#111827', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 2 }} />
                      {/* 예측가 마커 */}
                      <div style={{ position: 'absolute', left: `${rangePos(result.predicted_price)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: '#6366f1', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(99,102,241,0.4)', zIndex: 2 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: -16 }}>
                      <span>하방 {fmt(result.lower)}</span>
                      <span>상방 {fmt(result.upper)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#111827' }} />
                        <span style={{ fontSize: 11, color: '#6b7280' }}>현재가 {fmt(currentPrice)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1' }} />
                        <span style={{ fontSize: 11, color: '#6b7280' }}>AI 예측가</span>
                      </div>
                    </div>
                  </div>

                  {/* 상방/하방 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '16px', border: '1px solid #bbf7d0' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>📈 상방 시나리오</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#15803d' }}>{fmt(result.upper)}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a' }}>+{((result.upper - currentPrice) / currentPrice * 100).toFixed(1)}%</p>
                    </div>
                    <div style={{ background: '#fef2f2', borderRadius: 12, padding: '16px', border: '1px solid #fecaca' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#dc2626', fontWeight: 700 }}>📉 하방 시나리오</p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>{fmt(result.lower)}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>{((result.lower - currentPrice) / currentPrice * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* LLM 리포트 */}
                  {result.llm_report && (
                    <div style={{ marginBottom: 20 }}>
                      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111827' }}>🤖 AI 분석 리포트</p>
                      {result.llm_report.split(/(?=��|📈|📉|⚠️)/).filter(s => s.trim()).map((section, i) => (
                        <div key={i} style={{ marginBottom: 12, padding: 14, borderRadius: 10, background: i % 2 === 0 ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0' }}>
                          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>{section.trim()}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
                    ※ Prophet 시계열 모델 기반 예측이며 투자 권유가 아닙니다. 실제 주가는 다양한 외부 요인으로 달라질 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DatePredictModal;