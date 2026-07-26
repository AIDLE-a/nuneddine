import React, { useState, useEffect } from 'react';
import NewsAgentModal from './NewsAgentModal';
import DetailReportModal from './DetailReportModal';
import { savePrediction } from './predictionStorage';
import AnalystTargetModal from './AnalystTargetModal';

function AiReportCard({ stock, analysis, isLoading }) {
  const [showFinancial, setShowFinancial] = useState(false);

  const reportText = analysis ? null : stock?.aiReport;
  const warningText = analysis
    ? (analysis.warnings && analysis.warnings.length > 0 ? analysis.warnings.join(' / ') : null)
    : stock?.aiWarning;

  const finalDayPrediction = analysis?.prediction?.length
    ? analysis.prediction[analysis.prediction.length - 1]
    : null;

  const todayPrediction = analysis?.prediction?.length
    ? analysis.prediction[0]
    : null;

  const predictedPrice = finalDayPrediction
    ? (finalDayPrediction.future_price ?? finalDayPrediction.price ?? 0)
    : 0;

  const financial = analysis?.financial;

  // 분석할 때마다 예측 기록 자동 저장
  useEffect(() => {
    if (!stock?.code || !todayPrediction || !analysis) return;

    const today = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });

    const prices = analysis.price_history || [];
    const currentPrice = analysis.price || 0;
    const prevPrice = prices.length >= 2 ? prices[prices.length - 2] : null;

    const record = {
      date: today,
      savedAt: new Date().toISOString(),
      lower: todayPrediction.lower,
      upper: todayPrediction.upper,
      predictedPrice: todayPrediction.future_price,
      confidence: todayPrediction.confidence_score,
      currentPrice,
      prevPrice,
      compositeAlpha: analysis.composite_alpha,
      sentiment: analysis.sentiment,
      newsCount: analysis.news?.length || 0,
    };

    savePrediction(stock.code, stock.name, record);
  }, [analysis]);

  const financialItems = financial ? [
    { label: 'PER (주가수익비율)', value: financial.per ? `${financial.per.toFixed(2)}배` : (financial.forward_per ? `${financial.forward_per.toFixed(2)}배 (예상)` : '–'), desc: '낮을수록 저평가', good: financial.per ? financial.per < 15 : null },
    { label: 'PBR (주가순자산비율)', value: financial.pbr ? `${financial.pbr.toFixed(2)}배` : '–', desc: '1 미만이면 자산 대비 저평가', good: financial.pbr ? financial.pbr < 1 : null },
    { label: 'ROE (자기자본이익률)', value: financial.roe ? `${(financial.roe * 100).toFixed(1)}%` : '–', desc: '높을수록 수익성 좋음', good: financial.roe ? financial.roe > 0.1 : null },
    { label: '부채비율', value: financial.debt_to_equity ? `${financial.debt_to_equity.toFixed(1)}%` : '–', desc: '낮을수록 재무 안정적', good: financial.debt_to_equity ? financial.debt_to_equity < 100 : null },
    { label: '매출 성장률', value: financial.revenue_growth ? `${(financial.revenue_growth * 100).toFixed(1)}%` : '–', desc: '전년 대비 매출 증가율', good: financial.revenue_growth ? financial.revenue_growth > 0 : null },
    { label: '영업이익 성장률', value: financial.earnings_growth ? `${(financial.earnings_growth * 100).toFixed(1)}%` : '–', desc: '전년 대비 영업이익 증가율', good: financial.earnings_growth ? financial.earnings_growth > 0 : null },
    { label: '영업이익률', value: financial.operating_margin ? `${(financial.operating_margin * 100).toFixed(1)}%` : '–', desc: '높을수록 수익성 좋음', good: financial.operating_margin ? financial.operating_margin > 0.1 : null },
    { label: '유동비율', value: financial.current_ratio ? `${financial.current_ratio.toFixed(2)}` : '–', desc: '1.5 이상이면 단기 안정적', good: financial.current_ratio ? financial.current_ratio > 1.5 : null },
  ] : [];

  return (
    <>
      <div className="card report-section">
        <h3>AI 리포트 <span className="text-muted font-normal">Critic Agent 검토 완료</span></h3>
        {isLoading ? (
          <p className="text-muted">AI 리포트 생성 중...</p>
        ) : (
          <>
            {/* 💡 감성 언급 없이 예측가 중심의 단정한 요약 문구 */}
            <p className="report-text">
              {analysis && finalDayPrediction
                ? `${stock?.name || '해당 종목'}의 최신 데이터 및 수급 지표를 종합 분석한 결과, 7일 후 예상 주가는 ${
                    stock?.code?.includes('.KS')
                      ? `${predictedPrice.toLocaleString()}원`
                      : `$${predictedPrice}`
                  }으로 전망됩니다.`
                : reportText}
            </p>

            {/* 거래량 분석 */}
            {analysis && analysis.volume_analysis && (
              <div className="report-volume-box" style={{ backgroundColor: 'var(--card-hover-bg, #f3f4f6)', borderLeft: '4px solid #10B981', padding: '12px 16px', borderRadius: '6px', marginTop: '12px', fontSize: '13px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                <span style={{ marginRight: '6px' }}>📊</span>
                <strong>거래량 분석:</strong> {analysis.volume_analysis}
              </div>
            )}

            {/* ⚠️ 경고 및 모순 알림 */}
            {warningText && (
              <div className="report-alert-box" style={{ marginTop: '12px' }}>
                <span>{warningText}</span>
                <span className="alert-badge">⚠ 근거 부족</span>
                <span>이 구간의 예측 신뢰도는 제한적입니다.</span>
              </div>
            )}

            {/* 하단 모달/버튼 영역 */}
            <div className="report-buttons" style={{ marginTop: '16px' }}>
              <AnalystTargetModal analysis={analysis} stock={stock} />
              <DetailReportModal stock={stock} analysis={analysis} />
              {financial && (
                <button className="btn-secondary" onClick={() => setShowFinancial(true)}>
                  재무제표 ↗
                </button>
              )}
              <NewsAgentModal analysis={analysis} />
            </div>
          </>
        )}
      </div>

      {/* 재무제표 모달 */}
      {showFinancial && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowFinancial(false)}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: '#111827', fontSize: 16 }}>재무제표 핵심 지표</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>yFinance 기준 · 최신 공시 데이터</p>
              </div>
              <button onClick={() => setShowFinancial(false)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {financialItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 12px', borderBottom: i < financialItems.length - 1 ? '1px solid #f3f4f6' : 'none', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#ffffff' : '#fafafa'}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#111827' }}>{item.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{item.desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.good !== null && item.value !== '–' && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: item.good ? '#dcfce7' : '#fee2e2', color: item.good ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                        {item.good ? '양호' : '주의'}
                      </span>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', minWidth: 80, textAlign: 'right' }}>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              ※ 재무지표는 투자 참고용이며 투자 권유가 아닙니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default AiReportCard;