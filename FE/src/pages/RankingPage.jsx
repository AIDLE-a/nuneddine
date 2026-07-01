import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useNavigate } from 'react-router-dom';

function RankingPage({ onAnalyze }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'stockStats'), orderBy('count', 'desc'), limit(10));
    const unsub = onSnapshot(q, snap => {
      setRanking(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
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
        <h1 className="page-title">인기 주식 랭킹</h1>
      </div>
      <p className="ranking-subtitle">현재 실시간으로 분석이 많이 되고 있는 주식입니다.</p>

      {loading ? (
        <div className="community-empty">불러오는 중...</div>
      ) : ranking.length === 0 ? (
        <div className="community-empty">아직 분석된 주식이 없습니다.</div>
      ) : (
        <div className="ranking-list">
          {ranking.map((item, idx) => (
            <div key={item.id} className="ranking-item">
              <span className={`ranking-num${idx < 3 ? ' top' : ''}`}>{idx + 1}</span>
              <div className="ranking-info">
                <span className="ranking-name">{item.name}</span>
                <span className="ranking-ticker">{item.ticker}</span>
              </div>
              <span className="ranking-count">🔍 {item.count}회</span>
              <button className="ranking-analyze-btn" onClick={() => handleAnalyze(item)}>
                나도 분석하기
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RankingPage;
