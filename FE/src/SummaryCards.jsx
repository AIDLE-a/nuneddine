import React from 'react';
import { isKoreanStock, formatPrice } from './currencyUtils.js';

function SummaryCards({ stock, analysis, isLoading, isFavorite, onToggleFavorite }) {
  if (isLoading) {
    return (
      <div className="summary-grid">
        {['현재가', '7일 예측가', '감성 방향', '분석 뉴스'].map((title) => (
          <div key={title} className="card summary-card">
            <span className="card-title">{title}</span>
            <span className="card-value text-muted">분석 중...</span>
          </div>
        ))}
      </div>
    );
  }

  if (analysis) {
    const { price, prediction, sentiment, news } = analysis;
    const korean = isKoreanStock(stock, analysis);
    const formattedPrice = formatPrice(price, korean);
    const formattedPredict = formatPrice(prediction.future_price, korean);
    const posStr = Math.round(sentiment.positive * 100);
    const negStr = Math.round(sentiment.negative * 100);
    const sentimentLabel = posStr > 60 ? '긍정 압도' : posStr > negStr + 15 ? '긍정 우세' : negStr > posStr + 15 ? '부정 우세' : '중립 혼재';
    const newsCountStr = `${news.length}건`;
    const newsStatus = news.length >= 10 ? '충분' : news.length >= 5 ? '적정' : '권장치 미달';

    return (
      <div className="summary-grid">
        <div className="card summary-card">
          <span className="card-title">{stock.name} 현재가</span>
          <span className="card-value">{formattedPrice}</span>
        </div>
        <div className="card summary-card">
          <span className="card-title">7일 예측가</span>
          <span className="card-value">{formattedPredict}</span>
          <span className="card-sub text-muted">
            {korean
              ? `${prediction.lower.toLocaleString()} ~ ${prediction.upper.toLocaleString()}원`
              : `$${prediction.lower} ~ $${prediction.upper}`}
          </span>
        </div>
        <div className="card summary-card">
          <span className="card-title">감성 방향</span>
          <span className="card-value">{sentimentLabel}</span>
          <span className="card-sub text-muted">긍정 {posStr}% / 부정 {negStr}%</span>
        </div>
        <div className="card summary-card">
          <span className="card-title">분석 뉴스</span>
          <span className="card-value">{newsCountStr}</span>
          <span className={`card-sub ${newsStatus === '권장치 미달' ? 'negative' : 'positive'}`}>{newsStatus}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="summary-grid">
      <div className="card summary-card">
        <span className="card-title">{stock.name} 현재가</span>
        <span className="card-value">{stock.price}</span>
        <span className={`card-sub ${stock.isPositive ? 'positive' : 'negative'}`}>{stock.change}</span>
      </div>
      <div className="card summary-card">
        <span className="card-title">7일 예측가</span>
        <span className="card-value">{stock.predict7d}</span>
        <span className="card-sub text-muted">{stock.range}</span>
      </div>
      <div className="card summary-card">
        <span className="card-title">감성 방향</span>
        <span className="card-value">{stock.sentiment}</span>
        <span className="card-sub text-muted">{stock.sentimentSub}</span>
      </div>
      <div className="card summary-card">
        <span className="card-title">분석 뉴스</span>
        <span className="card-value">{stock.newsCount}</span>
        <span className={`card-sub ${stock.newsStatus === '권장치 미달' ? 'negative' : 'positive'}`}>
          {stock.newsStatus}
        </span>
      </div>
    </div>
  );
}

export default SummaryCards;
