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
          <h4 className="rec-panel-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            연관 종목 추천
          </h4>
          <div className="rec-panel-body">
            {Object.entries(recBySector).map(([sector, recs]) => (
              <div key={sector} className="rec-sector-group">
                <span className="rec-sector-label">{sector}</span>
                <div className="watchlist-chips" style={{ marginTop: 4, maxHeight: 'none', overflow: 'visible' }}>
                  {recs.map(r => (
                    <div
                      key={r.ticker}
                      className="watchlist-chip watchlist-chip--rec"
                      onClick={() => onSelectStock(makeStockObj(r.ticker, r.name))}
                      title={r.ticker}
                    >
                      <span className="watchlist-chip-name">{r.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default WatchlistPanel;
