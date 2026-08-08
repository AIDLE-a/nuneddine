import React, { useState } from 'react';
import NewsAgentModal from './NewsAgentModal';
import DatePredictModal from './DatePredictModal';
import DetailReportModal from './DetailReportModal';
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

  const predictedPrice = finalDayPrediction
    ? (finalDayPrediction.future_price ?? finalDayPrediction.price ?? 0)
    : 0;

  const financial = analysis?.financial;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, flexShrink: 0, display: 'inline-flex' }}>AI 리포트 <span className="text-muted font-normal">Critic Agent 검토 완료</span></h3>
          <div className="report-buttons" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
            <AnalystTargetModal analysis={analysis} stock={stock} />
            <DetailReportModal stock={stock} analysis={analysis} />
            {financial && (
              <button className="btn-secondary" onClick={() => setShowFinancial(true)}>
                재무제표
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </button>
            )}
            <DatePredictModal stock={stock} analysis={analysis} />
            <NewsAgentModal analysis={analysis} />
          </div>
        </div>
        {isLoading ? (
          <p className="text-muted">AI 리포트 생성 중...</p>
        ) : (
          <>
            <p className="report-text" style={{ fontWeight: 700 }}>
              {analysis && finalDayPrediction
                ? `${stock?.name || '해당 종목'}의 최신 데이터 및 수급 지표를 종합 분석한 결과, 7일 후 예상 주가는 ${
                    (stock?.code?.includes('.KS') || stock?.code?.includes('.KQ'))
                      ? `${predictedPrice.toLocaleString()}원`
                      : `$${predictedPrice.toLocaleString()}`
                  }으로 전망됩니다.`
                : reportText}
            </p>

            {/* 거래량 분석 */}
            {analysis && analysis.volume_analysis && (
              <div className="volume-insight-box">
                <div className="volume-insight-label">거래량</div>
                <p className="volume-insight-text">{analysis.volume_analysis}</p>
              </div>
            )}

            {/* 경고 알림 */}
            {warningText && (
              <div className="report-alert-box" style={{ marginTop: '12px' }}>
                <span>{warningText}</span>
                <span className="alert-badge">⚠ 근거 부족</span>
                <span>이 구간의 예측 신뢰도는 제한적입니다.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 재무제표 모달 */}
      {showFinancial && (
        <div className="modal-overlay" onClick={() => setShowFinancial(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 'normal', textTransform: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--gradient)', flexShrink: 0 }} />
                재무제표 핵심 지표
              </h3>
              <button onClick={() => setShowFinancial(false)} className="modal-close">✕</button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 12 }}>
              {financialItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: i < financialItems.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.good !== null && item.value !== '–' && (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: item.good ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: item.good ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>
                        {item.good ? '양호' : '주의'}
                      </span>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', minWidth: 80, textAlign: 'right' }}>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              ※ 재무지표는 투자 참고용이며 투자 권유가 아닙니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default AiReportCard;
