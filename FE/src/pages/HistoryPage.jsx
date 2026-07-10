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

function HistoryPage({ history, onDeleteHistory, onAnalyze }) {
  const navigate = useNavigate();

  const handleAnalyze = (ticker, name) => {
    onAnalyze(makeStockObj(ticker, name));
    navigate('/');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">분석 기록</h1>
        <p className="page-subtitle">최근 분석한 종목 목록입니다</p>
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <p className="empty-state-text">분석 기록이 없습니다</p>
          <button className="btn-primary" onClick={() => navigate('/')}>종목 분석하러 가기</button>
        </div>
      ) : (
        <div className="history-list">
          {history.map((h, i) => (
            <div key={h.ticker ?? i} className="history-item">
              <div className="history-item-info">
                <span className="history-rank">{i + 1}</span>
                <div>
                  <p className="history-name">{h.name}</p>
                  <p className="history-ticker">{h.ticker}</p>
                </div>
              </div>
              <div className="history-item-actions">
                <button
                  className="btn-analyze-sm"
                  onClick={() => handleAnalyze(h.ticker, h.name)}
                >
                  다시 분석
                </button>
                <button
                  className="btn-icon btn-danger"
                  onClick={() => onDeleteHistory(h.ticker)}
                  title="기록 삭제"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
