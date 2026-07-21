import React from 'react';
import { getStockCurrency, formatPrice } from './currencyUtils.js';

function StockNameHeader({ stock, isFavorite, onToggleFavorite }) {
  return (
    <div className="summary-stock-header">
      <div className="summary-stock-meta">
        <span className="summary-stock-ticker">{stock.code}</span>
      </div>
      <div className="summary-stock-name-row">
        <span className="summary-stock-name">{stock.name}</span>
        <button
          onClick={onToggleFavorite}
          title={isFavorite ? '관심 종목 해제' : '관심 종목 추가'}
          className="summary-star-btn"
          style={{ color: isFavorite ? '#F59E0B' : 'var(--text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ stock, analysis, isLoading, isFavorite, onToggleFavorite }) {
  if (isLoading) {
    return (
      <div className="summary-grid">
        <div className="card summary-card summary-card-main">
          <StockNameHeader stock={stock} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
          <span className="card-value loading-dash" style={{ marginTop: 8 }}>----</span>
          <span className="card-sub text-muted loading-dash">----</span>
        </div>
        {['7일 예측가', '감성 방향', '분석 뉴스'].map((title) => (
          <div key={title} className="card summary-card">
            <span className="card-title">{title}</span>
            <span className="card-value text-muted loading-dash">----</span>
          </div>
        ))}
      </div>
    );
  }

  if (analysis) {
    const { price, prediction, sentiment, news } = analysis;
    const currency = getStockCurrency(stock, analysis);
    const formattedPrice = formatPrice(price, currency);

    // ── 어제 대비 오늘 변동 계산 ──
    const priceHistory = analysis.price_history || [];
    const yesterdayPrice = priceHistory.length >= 2
      ? priceHistory[priceHistory.length - 2]
      : null;
    const priceChange = yesterdayPrice != null ? price - yesterdayPrice : null;
    const priceChangePct = yesterdayPrice != null
      ? ((price - yesterdayPrice) / yesterdayPrice * 100)
      : null;
    const changeStr = priceChange != null
      ? `${priceChange >= 0 ? '+' : ''}${priceChange.toLocaleString()}원 (${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(1)}%)`
      : stock.change;
    const isPositive = priceChange != null ? priceChange >= 0 : stock.isPositive;

    // 예측가
    const finalDayPrediction = prediction?.length ? prediction[prediction.length - 1] : null;
    const formattedPredict = finalDayPrediction ? formatPrice(finalDayPrediction.future_price, currency) : '-';
    const formattedLower = finalDayPrediction ? formatPrice(finalDayPrediction.lower, currency) : '-';
    const formattedUpper = finalDayPrediction ? formatPrice(finalDayPrediction.upper, currency) : '-';

    // 감성
    const posStr = Math.round(sentiment.positive * 100);
    const negStr = Math.round(sentiment.negative * 100);
    const sentimentLabel = posStr > 60 ? '긍정 압도'
      : posStr > negStr + 15 ? '긍정 우세'
      : negStr > posStr + 15 ? '부정 우세'
      : '중립 혼재';

    // 뉴스
    const newsCountStr = `${news.length}건`;
    const newsStatus = news.length >= 10 ? '충분' : news.length >= 5 ? '적정' : '권장치 미달';

    return (
      <div className="summary-grid">
        <div className="card summary-card summary-card-main">
          <StockNameHeader stock={stock} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
          <span className="card-value" style={{ marginTop: 8 }}>{formattedPrice}</span>
          <span className={`card-sub ${isPositive ? 'positive' : 'negative'}`}>{changeStr}</span>
        </div>
        <div className="card summary-card">
          <span className="card-title">7일 예측가</span>
          <span className="card-value">{formattedPredict}</span>
          <span className="card-sub text-muted">{formattedLower} ~ {formattedUpper}</span>
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
      <div className="card summary-card summary-card-main">
        <StockNameHeader stock={stock} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
        <span className="card-value" style={{ marginTop: 8 }}>{stock.price}</span>
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