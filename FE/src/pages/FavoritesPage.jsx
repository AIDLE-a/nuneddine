import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_STOCKS } from '../App.jsx';

function makeStockObj(ticker, name) {
  return MOCK_STOCKS.find(s => s.code === ticker) ?? {
    name, code: ticker, price: '-', change: '-', isPositive: true,
    predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
    newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
  };
}

function FavoritesPage({ favorites, onRemoveFavorite, onAnalyze }) {
  const navigate = useNavigate();

  const handleAnalyze = (ticker, name) => {
    onAnalyze(makeStockObj(ticker, name));
    navigate('/');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">관심 종목</h1>
        <p className="page-subtitle">분석 화면의 ☆ 버튼으로 관심 종목을 추가하세요</p>
      </div>

      {favorites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <p className="empty-state-text">저장된 관심 종목이 없습니다</p>
          <button className="btn-primary" onClick={() => navigate('/')}>종목 분석하러 가기</button>
        </div>
      ) : (
        <div className="favorites-grid">
          {favorites.map(f => (
            <div key={f.ticker} className="favorite-card">
              <div className="favorite-card-header">
                <div>
                  <p className="favorite-ticker">{f.ticker}</p>
                  <h3 className="favorite-name">{f.name}</h3>
                </div>
                <button
                  className="btn-icon btn-danger"
                  onClick={() => onRemoveFavorite(f.ticker)}
                  title="관심 종목 해제"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <button
                className="btn-analyze-card"
                onClick={() => handleAnalyze(f.ticker, f.name)}
              >
                분석 시작 →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FavoritesPage;
