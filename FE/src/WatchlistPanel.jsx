import React from 'react';
import { MOCK_STOCKS } from './App.jsx';

function WatchlistPanel({ user, favorites, history, onSelectStock, onRemoveFavorite }) {
  const findStock = (ticker) => MOCK_STOCKS.find(s => s.code === ticker);

  return (
    <div className="watchlist-panel">
      {/* 관심 종목 */}
      <div className="watchlist-section">
        <h4 className="watchlist-title">⭐ 관심 종목</h4>
        {favorites.length === 0 ? (
          <p className="watchlist-empty">현재가 카드의 ☆ 버튼으로 추가해보세요</p>
        ) : (
          <div className="watchlist-chips">
            {favorites.map(f => (
              <div key={f.ticker} className="watchlist-chip">
                <span
                  className="watchlist-chip-name"
                  onClick={() => { const s = findStock(f.ticker); if (s) onSelectStock(s); }}
                >
                  {f.name}
                </span>
                <button
                  className="watchlist-chip-remove"
                  onClick={() => onRemoveFavorite(f.ticker)}
                  title="삭제"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 최근 분석 기록 */}
      <div className="watchlist-section">
        <h4 className="watchlist-title">🕒 최근 분석</h4>
        {history.length === 0 ? (
          <p className="watchlist-empty">분석 기록이 없습니다</p>
        ) : (
          <div className="watchlist-chips">
            {history.map((h, i) => (
              <div
                key={h.id ?? i}
                className="watchlist-chip watchlist-chip--history"
                onClick={() => { const s = findStock(h.ticker); if (s) onSelectStock(s); }}
              >
                <span className="watchlist-chip-name">{h.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WatchlistPanel;
