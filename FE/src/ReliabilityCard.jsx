import React from 'react';

function ReliabilityCard({ stock, analysis, isLoading }) {
  let score = 0, infoScore = 0, sentimentScore = 0, predictScore = 0, reportScore = 0;

  if (analysis) {
    score = analysis.confidence_score ?? 68;
    // 백엔드에서 넘겨주는 breakdown 객체 (snake_case 및 camelCase 대응)
    const breakdown = analysis.confidence_breakdown || analysis.confidenceBreakdown;

    if (breakdown) {
      // 백엔드(critic.py)가 계산한 정확한 breakdown 값을 그대로 사용
      infoScore = Math.round(breakdown.data_quality ?? breakdown.info ?? 70);
      sentimentScore = Math.round(breakdown.signal_score ?? breakdown.sentiment_flow ?? 70);
      predictScore = Math.round(breakdown.prediction_stability ?? breakdown.prediction ?? 70);
      reportScore = score;
    } else {
      // ⚠️ 폴백: 백엔드 breakdown이 아직 전달되지 않았을 때만 작동하는 보정 로직
      const pos = analysis.sentiment?.positive ?? 0.5;
      const neg = analysis.sentiment?.negative ?? 0.5;

      const newsCount = analysis.news?.length ?? 0;
      const newsConf = analysis.news_agent_confidence ?? 0.75;
      const newsQtyScore = Math.min(newsCount / 50, 1);
      infoScore = Math.round((newsQtyScore * 0.4 + newsConf * 0.6) * 100);

      // [수정] 100점 쏠림 현상을 막기 위한 폴백 스케일 정상화 (40 + clarity * 40)
      const clarity = Math.abs(pos - neg);
      sentimentScore = Math.round(40 + clarity * 40); 

      const predictionDays = analysis.prediction ?? [];
      const RATIO_MAX = 0.30;
      const dayScores = predictionDays
        .filter(p => p.future_price && p.future_price > 0)
        .map(p => {
          const spreadRatio = (p.upper - p.lower) / p.future_price;
          return Math.max(0, (1 - spreadRatio / RATIO_MAX)) * 100;
        });
      const avgPredictScore = dayScores.length > 0
        ? dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length
        : 60;
      predictScore = Math.round(avgPredictScore);

      reportScore = score;
    }
  } else {
    // 로딩 전/데이터 없음 기본 세팅값
    score = 68;
    infoScore = 72;
    sentimentScore = 65;
    predictScore = 65;
    reportScore = 68;
  }

  // 동적 색상 처리 (70점 이상 green, 50점 이상 amber, 이하 red)
  const scoreColor = score >= 70 ? 'var(--positive)' : score >= 50 ? '#F59E0B' : 'var(--negative)';

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="card reliability-section">
      <h3>종합 신뢰도</h3>
      {isLoading ? (
        <p className="text-muted">분석 중...</p>
      ) : (
        <div className="reliability-content">
          <div style={{ position: 'relative', width: 150, height: 150 }}>
            <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="75" cy="75" r={radius} fill="none" stroke="var(--ring-track, #E5E5E0)" strokeWidth="11" />
              <circle
                cx="75" cy="75" r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="11"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700
            }}>
              {score} / 100
            </div>
          </div>
          <div className="progress-group">
            {[
              { label: '정보', value: infoScore, color: 'var(--positive)' },
              { label: '감성/수급/재무/모멘텀', value: sentimentScore, color: '#F59E0B' },
              { label: '예측', value: predictScore, color: '#F59E0B' },
              { label: '리포트', value: reportScore, color: 'var(--positive)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="progress-item">
                <span>{label}</span>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${value}%`, backgroundColor: color }}></div>
                </div>
                <span className="bar-num">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReliabilityCard;