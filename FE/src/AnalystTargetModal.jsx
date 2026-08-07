import React, { useState } from 'react';

function AnalystTargetModal({ analysis, stock }) {
  const [show, setShow] = useState(false);

  const financial = analysis?.financial;
  if (!financial?.target_mean_price) return null;

  const current = analysis?.price || 0;
  const mean = financial.target_mean_price;
  const high = financial.target_high_price;
  const low = financial.target_low_price;
  const median = financial.target_median_price;
  const count = financial.analyst_count || 0;
  const rec = financial.recommendation || '';
  const trend = financial.recommendation_trend || [];

  const isKRW = stock?.code?.includes('.KS') || stock?.code?.includes('.KQ');
  const fmt = (v) => v ? (isKRW ? `${Math.round(v).toLocaleString()}원` : `$${v}`) : '-';

  const upside = current ? ((mean - current) / current * 100) : null;
  const upsideHigh = current ? ((high - current) / current * 100) : null;
  const upsideLow = current ? ((low - current) / current * 100) : null;

  const recLabel = {
    'strong_buy': { text: '강력매수', color: 'var(--positive)', bg: 'rgba(16,185,129,0.1)' },
    'buy': { text: '매수', color: 'var(--positive)', bg: 'rgba(16,185,129,0.08)' },
    'hold': { text: '보유', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    'sell': { text: '매도', color: 'var(--negative)', bg: 'rgba(239,68,68,0.1)' },
    'strong_sell': { text: '강력매도', color: 'var(--negative)', bg: 'rgba(239,68,68,0.1)' },
  }[rec] || { text: rec, color: 'var(--text-muted)', bg: 'var(--surface-2)' };

  const rangeWidth = high - low;
  const currentPos = rangeWidth > 0 ? Math.max(0, Math.min(100, (current - low) / rangeWidth * 100)) : 50;
  const meanPos = rangeWidth > 0 ? Math.max(0, Math.min(100, (mean - low) / rangeWidth * 100)) : 50;

  const periodLabel = { '0m': '이번달', '-1m': '1달전', '-2m': '2달전', '-3m': '3달전' };

  const TrendBar = ({ data }) => {
    const total = data.strong_buy + data.buy + data.hold + data.sell + data.strong_sell;
    if (total === 0) return null;
    const pct = (v) => Math.round(v / total * 100);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{periodLabel[data.period] || data.period}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>총 {total}명</span>
        </div>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 28 }}>
          {data.strong_buy > 0 && <div style={{ width: `${pct(data.strong_buy)}%`, background: 'var(--positive)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.strong_buy}</span></div>}
          {data.buy > 0 && <div style={{ width: `${pct(data.buy)}%`, background: 'var(--positive)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.buy}</span></div>}
          {data.hold > 0 && <div style={{ width: `${pct(data.hold)}%`, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.hold}</span></div>}
          {data.sell > 0 && <div style={{ width: `${pct(data.sell)}%`, background: 'var(--negative)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.sell}</span></div>}
          {data.strong_sell > 0 && <div style={{ width: `${pct(data.strong_sell)}%`, background: 'var(--negative)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.strong_sell}</span></div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {data.strong_buy > 0 && <span style={{ fontSize: 10, color: 'var(--positive)' }}>강력매수 {pct(data.strong_buy)}%</span>}
          {data.buy > 0 && <span style={{ fontSize: 10, color: 'var(--positive)' }}>매수 {pct(data.buy)}%</span>}
          {data.hold > 0 && <span style={{ fontSize: 10, color: '#F59E0B' }}>보유 {pct(data.hold)}%</span>}
          {data.sell > 0 && <span style={{ fontSize: 10, color: 'var(--negative)' }}>매도 {pct(data.sell)}%</span>}
          {data.strong_sell > 0 && <span style={{ fontSize: 10, color: 'var(--negative)' }}>강력매도 {pct(data.strong_sell)}%</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <button onClick={() => setShow(true)} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        증권사 목표주가
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </button>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="modal-header">
              <h3>증권사 목표주가</h3>
              <button onClick={() => setShow(false)} className="modal-close">✕</button>
            </div>

            {/* 투자의견 + 업사이드 요약 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="modal-section" style={{ margin: 0, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>컨센서스 투자의견</div>
                <span style={{ display: 'inline-block', fontSize: 14, fontWeight: 700, padding: '4px 14px', borderRadius: 20, background: recLabel.bg, color: recLabel.color }}>{recLabel.text}</span>
              </div>
              <div className="modal-section" style={{ margin: 0, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{stock?.name} · {count}명 컨센서스</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: upside >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                  {upside != null ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%` : '-'}
                </div>
              </div>
            </div>

            <div className="modal-body">

              {/* 목표주가 범위 */}
              <div style={{ marginBottom: 20 }}>
                <p className="modal-section-title">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  목표주가 범위
                </p>
                <div style={{ position: 'relative', marginBottom: 28 }}>
                  <div style={{ height: 10, borderRadius: 5, background: 'linear-gradient(90deg, rgba(239,68,68,0.3), rgba(245,158,11,0.2), rgba(16,185,129,0.3))', position: 'relative', border: '1px solid var(--border)' }}>
                    <div style={{ position: 'absolute', left: `${currentPos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--text-primary)', border: '3px solid var(--surface)', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 2 }} />
                    <div style={{ position: 'absolute', left: `${meanPos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', border: '3px solid var(--surface)', boxShadow: '0 2px 6px rgba(13,148,136,0.3)', zIndex: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <div><p style={{ margin: 0, fontSize: 10, color: 'var(--negative)', fontWeight: 600 }}>최저</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(low)}</p></div>
                    <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>평균</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{fmt(mean)}</p></div>
                    <div style={{ textAlign: 'right' }}><p style={{ margin: 0, fontSize: 10, color: 'var(--positive)', fontWeight: 600 }}>최고</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(high)}</p></div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--text-primary)' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>현재가 {fmt(current)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>평균 목표주가</span>
                    </div>
                  </div>
                </div>

                {/* 상세 수치 */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                  {[
                    { label: '목표주가 평균', value: fmt(mean), upside: upside, color: 'var(--accent)' },
                    { label: '목표주가 중앙값', value: fmt(median), upside: median && current ? (median - current) / current * 100 : null, color: 'var(--accent)' },
                    { label: '목표주가 최고', value: fmt(high), upside: upsideHigh, color: 'var(--positive)' },
                    { label: '목표주가 최저', value: fmt(low), upside: upsideLow, color: 'var(--negative)' },
                    { label: '현재가', value: fmt(current), upside: null, color: 'var(--text-primary)' },
                  ].map((item, i) => (
                    <div key={i} className="modal-row" style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.upside != null && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: item.upside >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: item.upside >= 0 ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                            {item.upside >= 0 ? '+' : ''}{item.upside.toFixed(1)}%
                          </span>
                        )}
                        <span style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 월별 투자의견 트렌드 */}
                {trend.length > 0 && (
                  <div>
                    <p className="modal-section-title">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                      투자의견 트렌드 (최근 4개월)
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { color: 'var(--positive)', label: '강력매수' }, { color: 'var(--positive)', label: '매수' },
                        { color: '#F59E0B', label: '보유' }, { color: 'var(--negative)', label: '매도' },
                        { color: 'var(--negative)', label: '강력매도' },
                      ].map((l, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                    {trend.map((d, i) => <TrendBar key={i} data={d} />)}
                  </div>
                )}
              </div>

              <div className="modal-section">
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  참고사항
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  · {count}명의 애널리스트 컨센서스 기준 (yFinance 제공)<br/>
                  · 목표주가는 12개월 기준 예측치예요<br/>
                  · 투자 권유가 아닌 참고 자료입니다
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AnalystTargetModal;
