import React from 'react';

function SummaryCards() {
  return (
    <div className="summary-grid">
      <div className="card summary-card">
        <span className="card-title">현재가</span>
        <span className="card-value">72,400원</span>
        <span className="card-sub positive">+1,200 (+1.7%)</span>
      </div>
      <div className="card summary-card">
        <span className="card-title">7일 예측가</span>
        <span className="card-value">73,500원</span>
        <span className="card-sub text-muted">68k ~ 76k 구간</span>
      </div>
      <div className="card summary-card">
        <span className="card-title">감성 방향</span>
        <span className="card-value">긍정 우세</span>
        <span className="card-sub text-muted">긍정 62% / 부정 31%</span>
      </div>
      <div className="card summary-card">
        <span className="card-title">분석 뉴스</span>
        <span className="card-value">8건</span>
        <span className="card-sub negative">권장치 미달</span>
      </div>
    </div>
  );
}

export default SummaryCards;