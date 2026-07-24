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
    'strong_buy': { text: '강력매수', color: '#10B981', bg: '#dcfce7' },
    'buy': { text: '매수', color: '#3B82F6', bg: '#dbeafe' },
    'hold': { text: '보유', color: '#F59E0B', bg: '#fef9c3' },
    'sell': { text: '매도', color: '#EF4444', bg: '#fee2e2' },
    'strong_sell': { text: '강력매도', color: '#991b1b', bg: '#fee2e2' },
  }[rec] || { text: rec, color: '#6b7280', bg: '#f3f4f6' };

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
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{periodLabel[data.period] || data.period}</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>총 {total}명</span>
        </div>
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 28 }}>
          {data.strong_buy > 0 && (
            <div style={{ width: `${pct(data.strong_buy)}%`, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.strong_buy}</span>
            </div>
          )}
          {data.buy > 0 && (
            <div style={{ width: `${pct(data.buy)}%`, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.buy}</span>
            </div>
          )}
          {data.hold > 0 && (
            <div style={{ width: `${pct(data.hold)}%`, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.hold}</span>
            </div>
          )}
          {data.sell > 0 && (
            <div style={{ width: `${pct(data.sell)}%`, background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.sell}</span>
            </div>
          )}
          {data.strong_sell > 0 && (
            <div style={{ width: `${pct(data.strong_sell)}%`, background: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>{data.strong_sell}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {data.strong_buy > 0 && <span style={{ fontSize: 10, color: '#059669' }}>강력매수 {pct(data.strong_buy)}%</span>}
          {data.buy > 0 && <span style={{ fontSize: 10, color: '#10B981' }}>매수 {pct(data.buy)}%</span>}
          {data.hold > 0 && <span style={{ fontSize: 10, color: '#F59E0B' }}>보유 {pct(data.hold)}%</span>}
          {data.sell > 0 && <span style={{ fontSize: 10, color: '#EF4444' }}>매도 {pct(data.sell)}%</span>}
          {data.strong_sell > 0 && <span style={{ fontSize: 10, color: '#991b1b' }}>강력매도 {pct(data.strong_sell)}%</span>}
        </div>
      </div>
    );
  };

  return (
    <>
      <button onClick={() => setShow(true)}
        style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #8B5CF6', background: 'transparent', color: '#8B5CF6', cursor: 'pointer', fontWeight: 500 }}>
        증권사 목표주가 ↗
      </button>

      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 0, width: '90%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', padding: '22px 24px', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: '#c4b5fd', letterSpacing: 2 }}>ANALYST CONSENSUS</p>
                  <h3 style={{ margin: '6px 0 0', color: '#fff', fontSize: 18, fontWeight: 800 }}>증권사 목표주가</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a78bfa' }}>{stock?.name} · 애널리스트 {count}명 컨센서스</p>
                </div>
                <button onClick={() => setShow(false)}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15 }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ margin: 0, fontSize: 10, color: '#c4b5fd' }}>컨센서스 투자의견</p>
                  <span style={{ display: 'inline-block', marginTop: 6, fontSize: 14, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: recLabel.bg, color: recLabel.color }}>
                    {recLabel.text}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ margin: 0, fontSize: 10, color: '#c4b5fd' }}>평균 목표주가 업사이드</p>
                  <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 800, color: upside >= 0 ? '#34d399' : '#f87171' }}>
                    {upside != null ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%` : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '22px 24px' }}>

              {/* 목표주가 범위 */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#111827' }}>📊 목표주가 범위</p>
                <div style={{ position: 'relative', marginBottom: 28 }}>
                  <div style={{ height: 12, borderRadius: 6, background: 'linear-gradient(90deg, #fee2e2, #fef9c3, #dcfce7)', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: `${currentPos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 18, height: 18, borderRadius: '50%', background: '#111827', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 2 }} />
                    <div style={{ position: 'absolute', left: `${meanPos}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 18, height: 18, borderRadius: '50%', background: '#8B5CF6', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(139,92,246,0.4)', zIndex: 2 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <div><p style={{ margin: 0, fontSize: 10, color: '#EF4444', fontWeight: 600 }}>최저</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#374151' }}>{fmt(low)}</p></div>
                    <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontSize: 10, color: '#8B5CF6', fontWeight: 600 }}>평균</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#8B5CF6' }}>{fmt(mean)}</p></div>
                    <div style={{ textAlign: 'right' }}><p style={{ margin: 0, fontSize: 10, color: '#10B981', fontWeight: 600 }}>최고</p><p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#374151' }}>{fmt(high)}</p></div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#111827' }} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>현재가 {fmt(current)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8B5CF6' }} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>평균 목표주가</span>
                    </div>
                  </div>
                </div>

                {/* 상세 수치 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                  {[
                    { label: '목표주가 평균', value: fmt(mean), upside: upside, color: '#8B5CF6' },
                    { label: '목표주가 중앙값', value: fmt(median), upside: median && current ? (median - current) / current * 100 : null, color: '#6d28d9' },
                    { label: '목표주가 최고', value: fmt(high), upside: upsideHigh, color: '#10B981' },
                    { label: '목표주가 최저', value: fmt(low), upside: upsideLow, color: '#EF4444' },
                    { label: '현재가', value: fmt(current), upside: null, color: '#111827' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>{item.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.upside != null && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: item.upside >= 0 ? '#dcfce7' : '#fee2e2', color: item.upside >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
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
                    <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#111827' }}>📈 투자의견 트렌드 (최근 4개월)</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { color: '#059669', label: '강력매수' },
                        { color: '#10B981', label: '매수' },
                        { color: '#F59E0B', label: '보유' },
                        { color: '#EF4444', label: '매도' },
                        { color: '#991b1b', label: '강력매도' },
                      ].map((l, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                          <span style={{ fontSize: 10, color: '#6b7280' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                    {trend.map((d, i) => <TrendBar key={i} data={d} />)}
                  </div>
                )}
              </div>

              <div style={{ background: '#f5f3ff', borderRadius: 10, padding: 14 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#6d28d9', fontWeight: 600 }}>💡 참고사항</p>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#7c3aed', lineHeight: 1.6 }}>
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