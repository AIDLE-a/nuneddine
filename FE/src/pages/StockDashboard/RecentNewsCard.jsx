import React from 'react';

function RecentNewsCard() {
  return (
    <div className="card news-section">
      <h3>최근 뉴스</h3>
      <div className="news-list">
        <div className="news-item">
          <h4>삼성전자, HBM4 양산 일정 앞당겨 <span className="badge positive">긍정</span></h4>
          <p className="text-muted">2시간 전 · 한국경제</p>
        </div>
        <div className="news-item">
          <h4>메모리 반도체 수요 둔화 우려 재부각 <span className="badge negative">부정</span></h4>
          <p className="text-muted">5시간 전 · 매일경제</p>
        </div>
        <div className="news-item">
          <h4>외국인 순매수 3거래일 연속 이어져 <span className="badge positive">긍정</span></h4>
          <p className="text-muted">어제 · 연합뉴스</p>
        </div>
      </div>
    </div>
  );
}

export default RecentNewsCard;