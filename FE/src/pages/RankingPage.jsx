import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useNavigate } from 'react-router-dom';
import { fetchPrices } from '../api.js';
import { getStockCurrency, formatPrice } from '../currencyUtils.js';

function RankingPage({ onAnalyze }) {
  const [ranking, setRanking] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const q = query(
      collection(db, 'stockAnalysisLog'),
      where('analyzedAt', '>=', since)
    );
    const unsub = onSnapshot(q, snap => {
      const countMap = {};
      snap.docs.forEach(d => {
        const { ticker, name } = d.data();
        if (!ticker) return;
        if (!countMap[ticker]) countMap[ticker] = { ticker, name, count: 0 };
        countMap[ticker].count += 1;
      });
      const sorted = Object.values(countMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setRanking(sorted);
      setLoading(false);

      if (sorted.length > 0) {
        fetchPrices(sorted.map(s => s.ticker))
          .then(p => setPrices(p))
          .catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  const handleAnalyze = (item) => {
    onAnalyze({ name: item.name, code: item.ticker,
      price: '-', change: '-', isPositive: true,
      predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
      newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '' });
    navigate('/');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">인기 종목</h1>
      </div>
      <p className="ranking-subtitle">최근 1시간 기준 분석 횟수가 많은 종목입니다.</p>

      {loading ? (
        <div className="community-empty">불러오는 중...</div>
      ) : ranking.length === 0 ? (
        <div className="community-empty">아직 분석된 주식이 없습니다.</div>
      ) : (
        <div className="ranking-list">
          {ranking.map((item, idx) => {
            const price = prices[item.ticker];
            const currency = getStockCurrency({ code: item.ticker });
            const priceStr = price != null ? formatPrice(price, currency) : null;
            return (
              <div key={item.ticker} className="ranking-item">
                <span className={`ranking-num${idx < 3 ? ' top' : ''}`}>{idx + 1}</span>
                <div className="ranking-info">
                  <span className="ranking-name">{item.name}</span>
                  <span className="ranking-ticker">{item.ticker}</span>
                </div>
                <div className="ranking-right">
                  {priceStr && <span className="ranking-price">{priceStr}</span>}
                  <div className="ranking-count-badge">
                    <span className="ranking-count-num">{item.count}</span>
                    <span className="ranking-count-label">회 분석</span>
                  </div>
                  <button className="ranking-analyze-btn" onClick={() => handleAnalyze(item)}>
                    나도 분석하기 →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RankingPage;
