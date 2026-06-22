import React from 'react';

function ReliabilityCard() {
  return (
    <div className="card reliability-section">
      <h3>종합 신뢰도</h3>
      <div className="reliability-content">
        <div className="mock-donut">68 / 100</div>
        <div className="progress-group">
          <div className="progress-item">
            <span>정보</span>
            <div className="bar"><div className="bar-fill info-bar" style={{width: '72%'}}></div></div>
            <span className="bar-num">72</span>
          </div>
          <div className="progress-item">
            <span>감성</span>
            <div className="bar"><div className="bar-fill sentiment-bar" style={{width: '58%'}}></div></div>
            <span className="bar-num">58</span>
          </div>
          <div className="progress-item">
            <span>예측</span>
            <div className="bar"><div className="bar-fill predict-bar" style={{width: '65%'}}></div></div>
            <span className="bar-num">65</span>
          </div>
          <div className="progress-item">
            <span>리포트</span>
            <div className="bar"><div className="bar-fill report-bar" style={{width: '80%'}}></div></div>
            <span className="bar-num">80</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReliabilityCard;