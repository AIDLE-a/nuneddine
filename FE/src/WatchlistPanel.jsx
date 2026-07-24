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
              style={{
                fontSize: 11,
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid var(--border-color, #ccc)',
                background: 'var(--btn-bg, #f5f5f5)',
                color: 'var(--text-color, #333)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              📈 추천 시스템 평가 리포트
            </button>
          </div>

          <div className="rec-panel-body">
            {Object.entries(recBySector).map(([sector, recs]) => (
              <div key={sector} className="rec-sector-group">
                <span className="rec-sector-label">{sector}</span>
                <div className="watchlist-chips" style={{ marginTop: 4, maxHeight: 'none', overflow: 'visible' }}>
                  {recs.map(r => (
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

                      {r.reason && (
                        <button
                          className="rec-reason-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenReasonTicker(prev => (prev === r.ticker ? null : r.ticker));
                          }}
                          title="왜 추천됐나요?"
                          style={{
                            marginLeft: 4,
                            fontSize: 10,
                            width: 14,
                            height: 14,
                            lineHeight: '14px',
                            borderRadius: '50%',
                            border: '1px solid var(--text-muted)',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          ?
                        </button>
                      )}

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
            ))}
          </div>
        </div>
      )}

      {/* 📊 오프라인 평가 지표 상세 모달 */}
      {showEvalModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-main, #222222)',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 550,
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>📈 추천 시스템 평가 리포트</h3>
              <button
                onClick={() => setShowEvalModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'inherit' }}
              >
                ✕
              </button>
            </div>

            {evalLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p>평가 지표를 재계산/불러오는 중입니다...</p>
              </div>
            ) : evalError ? (
              <div style={{ color: 'red', padding: '20px 0' }}>
                <p>⚠️ 오류 발생: {evalError}</p>
                <button onClick={() => fetchEvaluation(true)}>다시 시도</button>
              </div>
            ) : evalData ? (
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                {/* 1. 요약 카드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  marginBottom: 16
                }}>
                  <div style={{ background: 'var(--bg-sub, #f8f9fa)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'gray' }}>전체 커버리지 (Coverage)</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#2b6cb0' }}>
                      {((evalData.summary?.coverage ?? 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-sub, #f8f9fa)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'gray' }}>평균 추천 다양성 (Diversity)</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#2b6cb0' }}>
                      {(evalData.summary?.avg_diversity ?? 0).toFixed(3)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-sub, #f8f9fa)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'gray' }}>평균 참신성 (Novelty)</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#2b6cb0' }}>
                      {(evalData.summary?.avg_novelty ?? 0).toFixed(3)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-sub, #f8f9fa)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: 'gray' }}>평균 처리 속도 (Speed)</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#2b6cb0' }}>
                      {((evalData.summary?.avg_speed_ms ?? 0)).toFixed(1)} ms
                    </div>
                  </div>
                </div>

                {/* 2. 정확도 지표 */}
                {evalData.summary?.accuracy && (
                  <div style={{ marginBottom: 16, background: 'var(--bg-sub, #f8f9fa)', padding: 12, borderRadius: 8 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: 6 }}>🎯 정확도/재현율 (Accuracy & Recall)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'gray' }}>Hit Rate@K</div>
                        <div style={{ fontWeight: 'bold' }}>{((evalData.summary.accuracy.hit_rate ?? 0) * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'gray' }}>Precision@K</div>
                        <div style={{ fontWeight: 'bold' }}>{((evalData.summary.accuracy.precision ?? 0) * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'gray' }}>Recall@K</div>
                        <div style={{ fontWeight: 'bold' }}>{((evalData.summary.accuracy.recall ?? 0) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. 테스트 종목별 상세 세부 정보 */}
                <h4 style={{ margin: '16px 0 8px 0' }}>📋 종목별 상세 결과</h4>
                <div style={{ border: '1px solid var(--border-color, #eee)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-sub, #f1f3f5)', borderBottom: '1px solid var(--border-color, #eee)' }}>
                        <th style={{ padding: '6px 8px' }}>Ticker</th>
                        <th style={{ padding: '6px 8px' }}>다양성</th>
                        <th style={{ padding: '6px 8px' }}>참신성</th>
                        <th style={{ padding: '6px 8px' }}>속도</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evalData.details?.map((item) => (
                        <tr key={item.ticker} style={{ borderBottom: '1px solid var(--border-color, #eee)' }}>
                          <td style={{ padding: '6px 8px', fontWeight: '500' }}>{item.ticker}</td>
                          <td style={{ padding: '6px 8px' }}>{item.metrics?.diversity?.toFixed(3) ?? '-'}</td>
                          <td style={{ padding: '6px 8px' }}>{item.metrics?.novelty?.toFixed(3) ?? '-'}</td>
                          <td style={{ padding: '6px 8px' }}>{item.execution_time_ms?.toFixed(1)} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => fetchEvaluation(true)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      background: 'none',
                      border: '1px solid #aaa',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 평가 지표 강제 새로고침
                  </button>
                  <button
                    onClick={() => setShowEvalModal(false)}
                    style={{
                      padding: '6px 16px',
                      background: '#2b6cb0',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
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