import React from 'react';

function ReliabilityCard({ stock, analysis, isLoading }) {
  let score, infoScore, sentimentScore, predictScore, reportScore;

  if (analysis) {
    score = analysis.confidence_score;
    const pos = analysis.sentiment.positive;
    const neg = analysis.sentiment.negative;
    const newsRatio = Math.min(analysis.news.length / 10, 1);

    // prediction은 1일~7일 단위 배열
    // ⚠️ 기존 코드 문제 2가지 수정:
    //  1) 배율이 20% 기준(*500)으로 백엔드(heesun_forecast.py, RATIO_MAX=0.30)보다 과도하게 엄격했음
    //     → 30% 기준으로 통일
    //  2) "가장 불확실한 날(최댓값)" 하나로만 점수를 매겨서 항상 낮게 나왔음
    //     → 각 시점의 점수를 평균 내어 더 대표성 있는 값으로 변경
    const predictionDays = analysis.prediction ?? [];
    const RATIO_MAX = 0.30;

    const dayScores = predictionDays
      .filter(p => p.future_price && p.future_price > 0) // 0/음수 방어
      .map(p => {
        const spreadRatio = (p.upper - p.lower) / p.future_price;
        const dayScore = Math.max(0, (1 - spreadRatio / RATIO_MAX)) * 100;
        return dayScore;
      });

    const avgPredictScore = dayScores.length > 0
      ? dayScores.reduce((sum, s) => sum + s, 0) / dayScores.length
      : 50; // 예측 데이터가 없으면 중간값

    infoScore = Math.round(newsRatio * 100);
    sentimentScore = Math.round(Math.abs(pos - neg) * 100);
    predictScore = Math.round(avgPredictScore);
    reportScore = score;
  } else {
    score = 68;
    infoScore = 72;
    sentimentScore = 58;
    predictScore = 65;
    reportScore = 80;
  }

  const scoreColor = score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  // SVG 링: circumference 기반 dashoffset으로 점수 비율만큼 채움
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="card reliability-section">
      <h3>종합 신뢰도</h3>
      {isLoading ? (
        <p className="text-muted">분석 중...</p>
      ) : (
        <div className="reliability-content">
          <div style={{ position: 'relative', width: 130, height: 130 }}>
            <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
              {/* 배경 트랙 */}
              <circle cx="65" cy="65" r={radius} fill="none" stroke="var(--ring-track, #E5E5E0)" strokeWidth="9" />
              {/* 점수만큼 채워지는 링 */}
              <circle
                cx="65" cy="65" r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="9"
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
              { label: '정보', value: infoScore, color: '#10B981' },
              { label: '감성', value: sentimentScore, color: '#F59E0B' },
              { label: '예측', value: predictScore, color: '#F59E0B' },
              { label: '리포트', value: reportScore, color: '#10B981' },
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