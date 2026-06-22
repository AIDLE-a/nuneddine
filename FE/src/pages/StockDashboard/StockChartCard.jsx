import React from 'react';

function StockChartCard() {
  return (
    <div className="card chart-section">
      <h3>주가 예측 (Prophet · 7일)</h3>
      <div className="mock-chart">
        <p className="text-muted">[ 주가 그래프 차트 영역 ]</p>
      </div>
    </div>
  );
}

export default StockChartCard;