import React from 'react';

function SentimentCard({ stock, analysis, isLoading }) {
  let pos, neg, neu, explanation;

  if (analysis) {
    pos = Math.round(analysis.sentiment.positive * 100);
    neg = Math.round(analysis.sentiment.negative * 100);
    neu = Math.max(0, 100 - pos - neg);
    explanation = analysis.explanation || [];
  } else {
    const match = stock.sentimentSub.match(/긍정 (\d+)% \/ 부정 (\d+)%/);
    pos = match ? parseInt(match[1]) : 50;
    neg = match ? parseInt(match[2]) : 30;
    neu = Math.max(0, 100 - pos - neg);
    explanation = [];
  }

  const isMixed = Math.abs(pos - neg) < 15;

  return (
    <div className="card sentiment-section">
      <h3>감성 분석</h3>
      {isLoading ? (
        <p className="text-muted">분석 중...</p>
      ) : (
        <>
          <div className="sentiment-list">
            <div className="sentiment-row">
              <span>긍정</span>
              <div className="mini-bar"><div className="mini-bar-fill positive-bg" style={{ width: `${pos}%` }}></div></div>
              <span className="badge positive">{pos}%</span>
            </div>
            <div className="sentiment-row">
              <span>부정</span>
              <div className="mini-bar"><div className="mini-bar-fill negative-bg" style={{ width: `${neg}%` }}></div></div>
              <span className="badge negative">{neg}%</span>
            </div>
            <div className="sentiment-row">
              <span>중립</span>
              <div className="mini-bar"><div className="mini-bar-fill neutral-bg" style={{ width: `${neu}%` }}></div></div>
              <span className="badge">{neu}%</span>
            </div>
          </div>

          {isMixed && <div className="sentiment-warn">⚠ 방향성 혼재 감지</div>}

          {explanation.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>왜 이렇게 판단했나요?</p>
              {explanation.map((item, i) => {
                const maxAbs = Math.max(...explanation.map(e => Math.abs(e.contribution)), 0.01);
                const width = (Math.abs(item.contribution) / maxAbs) * 100;
                const isPos = item.contribution > 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, width: 100, flexShrink: 0, color: 'var(--text-sub)' }}>{item.word}</span>
                    <div style={{ flex: 1, background: 'var(--xai-track)', height: 14, borderRadius: 4 }}>
                      <div style={{ width: `${width}%`, height: '100%', background: isPos ? '#10B981' : '#EF4444', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>
                      {isPos ? '+' : ''}{item.contribution.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SentimentCard;
