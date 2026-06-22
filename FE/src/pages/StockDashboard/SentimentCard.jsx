import React from 'react';

function SentimentCard() {
  return (
    <div className="card sentiment-section">
      <h3>감성 분석</h3>
      <div className="sentiment-list">
        <div className="sentiment-row">
          <span>긍정</span>
          <div className="mini-bar"><div className="mini-bar-fill positive-bg" style={{width: '62%'}}></div></div>
          <span className="badge positive">62%</span>
        </div>
        <div className="sentiment-row">
          <span>부정</span>
          <div className="mini-bar"><div className="mini-bar-fill negative-bg" style={{width: '31%'}}></div></div>
          <span className="badge negative">31%</span>
        </div>
        <div className="sentiment-row">
          <span>중립</span>
          <div className="mini-bar"><div className="mini-bar-fill neutral-bg" style={{width: '7%'}}></div></div>
          <span className="badge">7%</span>
        </div>
      </div>
      <div className="sentiment-warn">⚠ 방향성 혼재 감지</div>
      <button className="btn-action-outline">코드 요청 ↗</button>
    </div>
  );
}

export default SentimentCard;