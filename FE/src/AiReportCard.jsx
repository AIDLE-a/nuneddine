import React from 'react';

function AiReportCard({ stock, analysis, isLoading }) {
  const reportText = analysis ? null : stock.aiReport;
  const warningText = analysis
    ? (analysis.warnings.length > 0 ? analysis.warnings.join(' / ') : null)
    : stock.aiWarning;

  return (
    <div className="card report-section">
      <h3>AI 리포트 <span className="text-muted font-normal">Critic Agent 검토 완료</span></h3>

      {isLoading ? (
        <p className="text-muted">AI 리포트 생성 중...</p>
      ) : (
        <>
          <p className="report-text">
            {analysis
              ? `${stock.name}에 대해 ${analysis.news.length}건의 뉴스를 분석했습니다.
                 긍정 감성 ${Math.round(analysis.sentiment.positive * 100)}%, 부정 ${Math.round(analysis.sentiment.negative * 100)}%로
                 ${analysis.sentiment.positive > analysis.sentiment.negative ? '긍정적' : '부정적'} 방향성이 우세합니다.
                 7일 후 예측가는 ${stock.code.includes('.KS')
                   ? `${analysis.prediction.future_price.toLocaleString()}원`
                   : `$${analysis.prediction.future_price}`}으로 예측됩니다.`
              : reportText}
          </p>

          {warningText && (
            <div className="report-alert-box">
              <span>{warningText}</span>
              <span className="alert-badge">⚠ 근거 부족</span>
              <span>이 구간의 예측 신뢰도는 제한적입니다.</span>
            </div>
          )}

          <div className="report-buttons">
            <button className="btn-secondary">경고 문구 상세 ↗</button>
            <button className="btn-secondary">과거 비교 ↗</button>
            <button className="btn-secondary">내보내기 ↗</button>
          </div>
        </>
      )}
    </div>
  );
}

export default AiReportCard;
