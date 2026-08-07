import React, { useState } from 'react';
import { MOCK_STOCKS } from './App.jsx';

function makeStockObj(ticker, name) {
  const existing = MOCK_STOCKS.find(s => s.code === ticker);
  return existing ?? {
    name, code: ticker,
    price: '-', change: '-', isPositive: true,
    predict7d: '-', range: '-',
    sentiment: '-', sentimentSub: '-',
    newsCount: '-', newsStatus: '적정',
    chartData: [], news: [], aiReport: '', aiWarning: '',
  };
}

function WatchlistPanel({ favorites, history, recommendations, onSelectStock, onRemoveFavorite, onDeleteHistory }) {
  const [hoveredHistory, setHoveredHistory] = useState(null);
  // 이유 툴팁이 열려있는 추천 종목의 ticker
  const [openReasonTicker, setOpenReasonTicker] = useState(null);

  // 📊 평가 지표 모달 상태
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalData, setEvalData] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState(null);

  // 평가 지표 API 호출
  const fetchEvaluation = async (forceRefresh = false) => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const res = await fetch(`/api/evaluation${forceRefresh ? '?force_refresh=true' : ''}`);
      if (!res.ok) throw new Error('평가 지표를 불러오지 못했습니다.');
      const data = await res.json();
      setEvalData(data);
    } catch (err) {
      setEvalError(err.message);
    } finally {
      setEvalLoading(false);
    }
  };

  const handleOpenEvalModal = () => {
    setShowEvalModal(true);
    if (!evalData) {
      fetchEvaluation();
    }
  };

  // 섹터별 그룹핑
  const recBySector = (recommendations ?? []).reduce((acc, r) => {
    const s = r.sector || '기타';
    if (!acc[s]) acc[s] = [];
    acc[s].push(r);
    return acc;
  }, {});

  return (
    <>
      {/* 관심 종목 + 최근 분석 패널 */}
      <div className="watchlist-panel">
        {/* 관심 종목 */}
        <div className="watchlist-section">
          <h4 className="watchlist-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            관심 종목
          </h4>
          {favorites.length === 0 ? (
            <p className="watchlist-empty">현재가 카드의 별 버튼으로 추가해보세요</p>
          ) : (
            <div className="watchlist-chips">
              {favorites.map(f => (
                <div key={f.ticker} className="watchlist-chip">
                  <span className="watchlist-chip-name" onClick={() => onSelectStock(makeStockObj(f.ticker, f.name))}>
                    {f.name}
                  </span>
                  <button className="watchlist-chip-remove" onClick={() => onRemoveFavorite(f.ticker)} title="삭제">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 분석 */}
        <div className="watchlist-section">
          <h4 className="watchlist-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            최근 분석
          </h4>
          {history.length === 0 ? (
            <p className="watchlist-empty">분석 기록이 없습니다</p>
          ) : (
            <div className="watchlist-chips">
              {history.map((h, i) => (
                <div
                  key={h.ticker ?? i}
                  className="watchlist-chip watchlist-chip--history"
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredHistory(h.ticker)}
                  onMouseLeave={() => setHoveredHistory(null)}
                  onClick={() => onSelectStock(makeStockObj(h.ticker, h.name))}
                >
                  <span className="watchlist-chip-name">{h.name}</span>
                  {hoveredHistory === h.ticker && (
                    <button
                      className="watchlist-chip-remove"
                      onClick={(e) => { e.stopPropagation(); onDeleteHistory(h.ticker); }}
                      title="기록 삭제"
                      style={{ marginLeft: 4 }}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 연관 종목 추천 — 별도 섹션 */}
      {Object.keys(recBySector).length > 0 && (
        <div className="rec-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 className="rec-panel-title" style={{ margin: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              연관 종목 추천
            </h4>

            {/* 📊 평가 지표 모달 오픈 버튼 */}
            <button
              onClick={handleOpenEvalModal}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              추천 시스템 평가 리포트
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </button>
          </div>

          <div className="watchlist-chips">
            {Object.values(recBySector).flat().map(r => (
              <div
                key={r.ticker}
                className="watchlist-chip watchlist-chip--rec"
                style={{ position: 'relative' }}
                title={r.ticker}
              >
                <span
                  className="watchlist-chip-name"
                  onClick={() => onSelectStock(makeStockObj(r.ticker, r.name))}
                >
                  {r.name}
                </span>

                {openReasonTicker === r.ticker && r.reason && (
                  <div
                    className="rec-reason-tooltip"
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: 0,
                      zIndex: 20,
                      background: 'var(--tooltip-bg)',
                      border: '1px solid var(--tooltip-border)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 12,
                      width: 200,
                      lineHeight: 1.4,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    {r.reason}
                    {(r.from_content || r.from_cf) && (
                      <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                        {r.from_content && r.from_cf
                          ? '가격 유사도 + 사용자 패턴 기반'
                          : r.from_content
                          ? '가격 유사도 기반'
                          : '사용자 관심등록 패턴 기반'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📊 오프라인 평가 지표 상세 모달 */}
      {showEvalModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15,41,34,0.35)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setShowEvalModal(false)}>
          <div style={{
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 24,
            width: '90%', maxWidth: 540,
            maxHeight: '85vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)',
            border: '1.5px solid var(--border)',
          }} onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                추천 시스템 평가 리포트
              </h3>
              <button onClick={() => setShowEvalModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>

            {evalLoading ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 14 }}>평가 지표를 불러오는 중입니다...</p>
              </div>
            ) : evalError ? (
              <div style={{ padding: '20px 0' }}>
                <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 12 }}>오류 발생: {evalError}</p>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => fetchEvaluation(true)}>다시 시도</button>
              </div>
            ) : evalData ? (
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>

                {/* 요약 카드 2×2 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: '전체 커버리지', value: `${((evalData.summary?.coverage ?? 0) * 100).toFixed(1)}%` },
                    { label: '평균 다양성', value: (evalData.summary?.avg_diversity ?? 0).toFixed(3) },
                    { label: '평균 참신성', value: (evalData.summary?.avg_novelty ?? 0).toFixed(3) },
                    { label: '평균 처리 속도', value: `${(evalData.summary?.avg_speed_ms ?? 0).toFixed(1)} ms` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* 정확도 지표 */}
                {evalData.summary?.accuracy && (
                  <div style={{ marginBottom: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                      정확도 / 재현율
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      {[
                        { label: 'Hit Rate@K', value: `${((evalData.summary.accuracy.hit_rate ?? 0) * 100).toFixed(1)}%` },
                        { label: 'Precision@K', value: `${((evalData.summary.accuracy.precision ?? 0) * 100).toFixed(1)}%` },
                        { label: 'Recall@K', value: `${((evalData.summary.accuracy.recall ?? 0) * 100).toFixed(1)}%` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 종목별 상세 */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>종목별 상세 결과</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        {['Ticker', '다양성', '참신성', '속도'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {evalData.details?.map((item, i) => (
                        <tr key={item.ticker} style={{ borderBottom: i < evalData.details.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--accent)' }}>{item.ticker}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{item.metrics?.diversity?.toFixed(3) ?? '-'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{item.metrics?.novelty?.toFixed(3) ?? '-'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{item.execution_time_ms?.toFixed(1)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 하단 버튼 */}
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => fetchEvaluation(true)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    새로고침
                  </button>
                  <button className="btn-analyze" style={{ fontSize: 13, padding: '8px 20px' }} onClick={() => setShowEvalModal(false)}>
                    닫기
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

export default WatchlistPanel;