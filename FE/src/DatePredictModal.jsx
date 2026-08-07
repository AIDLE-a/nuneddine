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
    if (days <= 7) return { label: '높음', color: 'var(--positive)', bg: '#f0fdf4', bar: 90 };
    if (days <= 30) return { label: '보통', color: '#F59E0B', bg: '#fffbeb', bar: 65 };
    if (days <= 90) return { label: '낮음', color: 'var(--negative)', bg: '#fef2f2', bar: 35 };
    return { label: '매우 낮음', color: 'var(--negative)', bg: '#fee2e2', bar: 15 };
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
      <button onClick={() => setShow(true)} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        날짜 예측
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </button>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="modal-header">
              <h3>날짜 예측 — {stock.name}</h3>
              <button onClick={() => setShow(false)} className="modal-close">✕</button>
            </div>

            {/* 날짜 선택 */}
            <div className="modal-section" style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>예측할 날짜 선택</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                  min={minDate} max={maxDateStr}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, outline: 'none', color: 'var(--text-primary)', background: 'var(--surface)', fontFamily: 'inherit' }} />
                <button onClick={handlePredict} disabled={!targetDate || loading}
                  style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: targetDate && !loading ? 'var(--accent)' : 'var(--border)', color: targetDate && !loading ? '#fff' : 'var(--text-muted)', cursor: targetDate && !loading ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  {loading ? '예측 중...' : '예측 →'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[{ label: '1주일', days: 7 }, { label: '1개월', days: 30 }, { label: '3개월', days: 90 }, { label: '6개월', days: 180 }].map(({ label, days }) => {
                  const d = new Date(); d.setDate(d.getDate() + days);
                  const ds = d.toISOString().split('T')[0];
                  return (
                    <button key={days} onClick={() => setTargetDate(ds)} className="btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px', background: targetDate === ds ? 'var(--accent-bg)' : undefined, borderColor: targetDate === ds ? 'var(--accent)' : undefined, color: targetDate === ds ? 'var(--accent)' : undefined }}>
                      {label} 후
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 본문 */}
            <div className="modal-body" style={{ paddingTop: 0 }}>

              {error && (
                <div className="modal-section" style={{ borderLeft: '3px solid var(--negative)', marginBottom: 16 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--negative)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    {error}
                  </p>
                </div>
              )}

              {!result && !error && !loading && (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10, opacity: 0.4 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <p style={{ fontSize: 14, margin: '0 0 6px', color: 'var(--text-secondary)' }}>날짜를 선택하고 예측하기를 눌러주세요</p>
                  <p style={{ fontSize: 12, margin: 0 }}>Prophet 시계열 모델로 해당 날짜의 예측가를 계산합니다</p>
                </div>
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--accent)' }}>
                  <p style={{ fontSize: 14 }}>Prophet 모델 예측 중...</p>
                </div>
              )}

              {result && (
                <div>
                  {/* 신뢰도 */}
                  <div style={{ borderRadius: 12, padding: '14px 18px', marginBottom: 16, border: `1px solid ${confLevel.color}44`, background: confLevel.bg + '33' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: confLevel.color }}>예측 신뢰도: {confLevel.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{result.days_ahead}일 후 ({result.target_date})</span>
                    </div>
                    <div style={{ background: 'var(--border)', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${confLevel.bar}%`, height: 8, borderRadius: 4, background: confLevel.color, transition: 'width 0.5s' }} />
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>날짜가 멀수록 불확실성이 높아집니다. 참고용으로만 활용하세요.</p>
                  </div>

                  {/* 예측가 메인 */}
                  <div style={{ background: 'var(--accent-bg)', borderRadius: 14, padding: '20px', marginBottom: 16, border: '1px solid var(--border)', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--accent)', fontWeight: 600, letterSpacing: 1 }}>AI 예측가</p>
                    <p style={{ margin: 0, fontSize: 34, fontWeight: 900, color: 'var(--text-primary)' }}>{fmt(result.predicted_price)}</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 14px', borderRadius: 20, background: result.change_pct >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: result.change_pct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                        {result.change_pct >= 0 ? '▲' : '▼'} {Math.abs(result.change_pct)}%
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>현재가 대비</span>
                    </div>
                  </div>

                  {/* 범위 시각화 */}
                  <div style={{ marginBottom: 16 }}>
                    <p className="modal-section-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                      예측 범위 시각화
                    </p>
                    <div style={{ position: 'relative', height: 10, background: 'linear-gradient(90deg, rgba(239,68,68,0.25), rgba(245,158,11,0.15), rgba(16,185,129,0.25))', borderRadius: 5, marginBottom: 24, border: '1px solid var(--border)' }}>
                      <div style={{ position: 'absolute', left: `${rangePos(currentPrice)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--text-primary)', border: '3px solid var(--surface)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 2 }} />
                      <div style={{ position: 'absolute', left: `${rangePos(result.predicted_price)}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--surface)', boxShadow: '0 2px 6px rgba(13,148,136,0.3)', zIndex: 2 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: -16 }}>
                      <span>하방 {fmt(result.lower)}</span>
                      <span>상방 {fmt(result.upper)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-primary)' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>현재가 {fmt(currentPrice)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI 예측가</span>
                      </div>
                    </div>
                  </div>

                  {/* 상방/하방 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 12, padding: 16, border: '1px solid rgba(16,185,129,0.2)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--positive)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                        상방 시나리오
                      </p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--positive)' }}>{fmt(result.upper)}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--positive)' }}>+{((result.upper - currentPrice) / currentPrice * 100).toFixed(1)}%</p>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 12, padding: 16, border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--negative)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 10.5 15.5 15.5 10.5 22 17"/><polyline points="16 17 22 17 22 11"/></svg>
                        하방 시나리오
                      </p>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--negative)' }}>{fmt(result.lower)}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--negative)' }}>{((result.lower - currentPrice) / currentPrice * 100).toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* LLM 리포트 */}
                  {result.llm_report && (
                    <div style={{ marginBottom: 16 }}>
                      <p className="modal-section-title">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
                        AI 분석 리포트
                      </p>
                      {(() => {
                        const renderBold = (text) => text.split(/\*\*(.*?)\*\*/g).map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
                        return result.llm_report.split(/\n\n+/).filter(s => s.trim()).map((section, i) => {
                          const clean = section.trim().replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/gu, '');
                          const titleMatch = clean.match(/^\*\*(.+?)\*\*/);
                          const title = titleMatch ? titleMatch[1] : null;
                          const body = titleMatch ? clean.replace(/^\*\*(.+?)\*\*\s*\n?/, '').trim() : clean;
                          return (
                            <div key={i} style={{ marginBottom: 10, padding: 14, borderRadius: 10, background: i % 2 === 0 ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                              {title && <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</p>}
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{renderBold(body)}</p>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                    ※ Prophet 시계열 모델 기반 예측이며 투자 권유가 아닙니다.
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