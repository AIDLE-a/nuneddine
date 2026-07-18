import React from 'react';

function AiReportCard({ stock, analysis, isLoading }) {
  const reportText = analysis ? null : stock.aiReport;
  const warningText = analysis
    ? (analysis.warnings.length > 0 ? analysis.warnings.join(' / ') : null)
    : stock.aiWarning;

  // prediction은 이제 1일~7일 단위 배열 — 7일 후(마지막 날) 값을 대표로 사용
  const finalDayPrediction = analysis?.prediction?.length
    ? analysis.prediction[analysis.prediction.length - 1]
    : null;

  return (
    <div className="card report-section">
      <h3>AI 리포트 <span className="text-muted font-normal">Critic Agent 검토 완료</span></h3>

      {isLoading ? (
        <p className="text-muted">AI 리포트 생성 중...</p>
      ) : (
        <>
          <p className="report-text">
            {analysis && finalDayPrediction
              ? `${stock.name}에 대해 ${analysis.news.length}건의 뉴스를 분석했습니다.
                 긍정 감성 ${Math.round(analysis.sentiment.positive * 100)}%, 부정 ${Math.round(analysis.sentiment.negative * 100)}%로
                 ${analysis.sentiment.positive > analysis.sentiment.negative ? '긍정적' : '부정적'} 방향성이 우세합니다.
                 7일 후 예측가는 ${stock.code.includes('.KS')
                   ? `${finalDayPrediction.future_price.toLocaleString()}원`
                   : `$${finalDayPrediction.future_price}`}으로 예측됩니다.`
              : reportText}
          </p>

          {/* ★ [여기가 추가된 부분입니다] 백엔드에서 분석한 거래량 코멘트를 보여주는 박스 */}
          {analysis && analysis.volume_analysis && (
            <div className="report-volume-box" style={{
              backgroundColor: 'var(--card-hover-bg, #f3f4f6)', // 테마 변수 활용 또는 연한 회색/파란색 기본값
              borderLeft: '4px solid #10B981', // 거래량의 초록색(Emerald)과 맞춤
              padding: '12px 16px',
              borderRadius: '6px',
              marginTop: '12px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: 'var(--text-primary)'
            }}>
              <span style={{ marginRight: '6px' }}>📊</span>
              <strong>거래량 분석:</strong> {analysis.volume_analysis}
            </div>
          )}

          {warningText && (
            <div className="report-alert-box" style={{ marginTop: '12px' }}>
              <span>{warningText}</span>
              <span className="alert-badge">⚠ 근거 부족</span>
              <span>이 구간의 예측 신뢰도는 제한적입니다.</span>
            </div>
          )}

          <div className="report-buttons" style={{ marginTop: '16px' }}>
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