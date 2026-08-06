import React, { useState } from 'react';

// ⚠️ [★버그 수정 2026-08-02]
// 기존 버그: sentimentAlpha를 이 컴포넌트가 (sentiment.positive - sentiment.negative)로
// 직접 재계산하고 있었음. 백엔드(연우님 감성 에이전트)는 이미 변동성까지 반영한
// 최종 보정값을 alpha.sentiment_alpha로 계산해서 내려주는데, 이 컴포넌트만 그 값을
// 쓰지 않고 원본값을 다시 만들어 쓰다 보니 "리포트 상단 요약"과 "AI Critic 본문"에
// 서로 다른 감성 알파 숫자가 동시에 노출되는 버그가 있었다.
// (예: 상단 요약 +0.326 vs 본문 +0.163 — 둘 다 실제로는 계산이 맞았지만, 하나는
// 보정 전 원본, 하나는 보정 후 값이라 사용자 입장에선 모순처럼 보였음)
//
// 수정: main.py가 StockAnalysisResponse.sentiment_alpha 필드에 최종 보정값을 실어
// 보내주므로, 이 컴포넌트는 그 값을 그대로 표시만 하고 재계산하지 않는다.
// (schemas.py, main.py 쪽 수정과 함께 적용되어야 함)

function DetailReportModal({ stock, analysis }) {
  const [show, setShow] = useState(false);

  // props 기본값 보장 (stock이나 analysis가 null/undefined일 경우 방어)
  const safeStock = stock || { name: '알 수 없음', code: '-' };
  const safeAnalysis = analysis || {};

  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

<<<<<<< HEAD
  const report = safeAnalysis.critic_report || 'AI Critic 리포트를 생성 중이거나 데이터가 부족합니다.';

  // ✅ 옵셔널 체이닝(?.) 및 기본값 0 설정
  const confidence = safeAnalysis.confidence_score ?? 0;

  const finalPred = safeAnalysis.prediction?.length
    ? safeAnalysis.prediction[safeAnalysis.prediction.length - 1]
    : null;

  const flowAlpha = safeAnalysis.flow_alpha || 0;
  const financialAlpha = safeAnalysis.financial_alpha || 0;
  const momentumAlpha = safeAnalysis.momentum_alpha || 0;
  const compositeAlpha = safeAnalysis.composite_alpha || 0;

  // ── ★[버그 수정] 서버가 계산한 최종(변동성 보정 완료) 값을 그대로 사용 ──
  // 기존: const sentimentAlpha = (safeAnalysis.sentiment?.positive || 0.5) - (safeAnalysis.sentiment?.negative || 0.5);
  // 위 방식은 백엔드의 변동성 보정을 무시하고 원본값을 재계산하는 버그였음.
  const sentimentAlpha = safeAnalysis.sentiment_alpha ?? 0;
=======
  const report = analysis?.critic_report || 'AI Critic 리포트를 생성 중이거나 데이터가 부족합니다.';
  const confidence = analysis?.confidence_score || 0;
  const finalPred = analysis?.prediction?.length
    ? analysis?.prediction[analysis?.prediction?.length - 1]
    : null;

  const flowAlpha = analysis?.flow_alpha || 0;
  const financialAlpha = analysis?.financial_alpha || 0;
  const momentumAlpha = analysis?.momentum_alpha || 0;
  const compositeAlpha = analysis?.composite_alpha || 0;
  const sentimentAlpha = (analysis?.sentiment?.positive || 0.5) - (analysis?.sentiment?.negative || 0.5);
>>>>>>> de1cd3335128e74cad3ec41f3b2dba212862cacf

  const getConfColor = (score) =>
    score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  const getAlphaColor = (val) =>
    val > 0.2 ? '#10B981' : val < -0.2 ? '#EF4444' : '#F59E0B';

  const getSignal = (val) =>
    val > 0.4 ? '강한매수' : val > 0.2 ? '매수' : val < -0.4 ? '강한매도' : val < -0.2 ? '매도' : '중립';

  const AlphaBar = ({ label, value, desc }) => {
    const pct = Math.round((value + 1) / 2 * 100);
    const color = getAlphaColor(value);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#6b7280' }}>{desc}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{value > 0 ? '+' : ''}{value.toFixed(3)}</span>
          </div>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: 8, background: '#9ca3af' }} />
          <div style={{
            position: 'absolute',
            left: value >= 0 ? '50%' : `${pct}%`,
            width: `${Math.abs(value) / 2 * 100}%`,
            background: color,
            height: 8,
            borderRadius: 4,
          }} />
        </div>
      </div>
    );
  };

  const handleSave = () => {
    const alphaSection = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  퀀트 알파 팩터 분석
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
감성 알파:    ${sentimentAlpha > 0 ? '+' : ''}${sentimentAlpha.toFixed(3)}
수급 알파:    ${flowAlpha > 0 ? '+' : ''}${flowAlpha.toFixed(3)}
재무 알파:    ${financialAlpha > 0 ? '+' : ''}${financialAlpha.toFixed(3)}
모멘텀 알파:  ${momentumAlpha > 0 ? '+' : ''}${momentumAlpha.toFixed(3)}
─────────────────────────
종합 알파:    ${compositeAlpha > 0 ? '+' : ''}${compositeAlpha.toFixed(3)} → ${getSignal(compositeAlpha)}
`;

    const content = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  누네띠네 AI 주식 리서치 리포트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

종목명: ${safeStock.name} (${safeStock.code})
분석일시: ${dateStr}
<<<<<<< HEAD
현재가: ${safeAnalysis.price?.toLocaleString() || '-'}원
7일 예측가: ${finalPred ? finalPred.future_price?.toLocaleString() + '원' : '-'}
=======
현재가: ${analysis?.price?.toLocaleString()}원
7일 예측가: ${finalPred ? finalPred.future_price.toLocaleString() + '원' : '-'}
>>>>>>> de1cd3335128e74cad3ec41f3b2dba212862cacf
신뢰구간: ${finalPred ? `${finalPred.lower?.toLocaleString()} ~ ${finalPred.upper?.toLocaleString()}원` : '-'}
종합 신뢰도: ${confidence}/100
${alphaSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  AI Critic 종합 분석
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${report}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  데이터 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<<<<<<< HEAD
감성: 긍정 ${Math.round((safeAnalysis.sentiment?.positive || 0) * 100)}% / 부정 ${Math.round((safeAnalysis.sentiment?.negative || 0) * 100)}%
뉴스 신뢰도: ${Math.round((safeAnalysis.news_agent_confidence || 0) * 100)}%
분석 뉴스: ${safeAnalysis.news?.length || 0}건
경고: ${safeAnalysis.warnings?.join(' / ') || '없음'}
=======
감성: 긍정 ${Math.round(analysis?.sentiment?.positive * 100)}% / 부정 ${Math.round(analysis?.sentiment?.negative * 100)}%
뉴스 신뢰도: ${Math.round((analysis?.news_agent_confidence || 0) * 100)}%
분석 뉴스: ${analysis?.news?.length || 0}건
경고: ${analysis?.warnings?.join(' / ') || '없음'}
>>>>>>> de1cd3335128e74cad3ec41f3b2dba212862cacf

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
※ 이 리포트는 AI가 자동 생성한 투자 참고용 자료이며
  투자 권유가 아닙니다. 투자 결정은 본인 책임입니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `누네띠네_${safeStock.name}_${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sections = report.split(/(?=📰|📊|💡|🔮|⚡|⚠️)/).filter(s => s.trim());

  return (
    <>
      <button
        onClick={() => setShow(true)}
        style={{
          fontSize: 12, padding: '4px 12px', borderRadius: 20,
          border: 'none', background: '#10B981',
          color: '#fff', cursor: 'pointer', fontWeight: 600
        }}
      >
        상세 리포트 ↗
      </button>

      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShow(false)}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 0, width: '90%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '24px 28px', borderRadius: '16px 16px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: '#64748b', letterSpacing: 3, textTransform: 'uppercase' }}>누네띠네 AI 리서치 리포트</p>
                  <h2 style={{ margin: '6px 0 0', color: '#fff', fontSize: 22, fontWeight: 800 }}>{safeStock.name}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{safeStock.code} · {dateStr}</p>
                </div>
                <button onClick={() => setShow(false)} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16 }}>✕</button>
              </div>

              {/* 핵심 지표 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 20 }}>
                {[
<<<<<<< HEAD
                  { label: '현재가', value: safeAnalysis.price ? `${safeAnalysis.price.toLocaleString()}원` : '-', color: '#fff' },
                  { label: '7일 예측가', value: finalPred ? `${finalPred.future_price?.toLocaleString()}원` : '-', color: '#F59E0B' },
=======
                  { label: '현재가', value: `${analysis?.price?.toLocaleString()}원`, color: '#fff' },
                  { label: '7일 예측가', value: finalPred ? `${finalPred.future_price.toLocaleString()}원` : '-', color: '#F59E0B' },
>>>>>>> de1cd3335128e74cad3ec41f3b2dba212862cacf
                  { label: '종합 신뢰도', value: `${confidence}/100`, color: getConfColor(confidence) },
                  { label: '종합 알파', value: `${compositeAlpha > 0 ? '+' : ''}${compositeAlpha.toFixed(3)}`, color: getAlphaColor(compositeAlpha) },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>{item.label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* 알파 신호 */}
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>종합 투자 신호:</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, padding: '3px 12px', borderRadius: 20,
                  background: getAlphaColor(compositeAlpha) + '30',
                  color: getAlphaColor(compositeAlpha),
                  border: `1px solid ${getAlphaColor(compositeAlpha)}50`
                }}>
                  {getSignal(compositeAlpha)}
                </span>
                <span style={{ fontSize: 11, color: '#475569' }}>
                  (감성 30% + 수급 30% + 재무 20% + 모멘텀 20%)
                </span>
              </div>
            </div>

            {/* 본문 */}
            <div style={{ padding: '24px 28px' }}>

              {/* 알파 팩터 시각화 */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, marginBottom: 20, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>📐 퀀트 알파 팩터 분석</p>
                <AlphaBar label="감성 알파" value={sentimentAlpha} desc="뉴스 긍정/부정 신호" />
                <AlphaBar label="수급 알파" value={flowAlpha} desc="외국인/기관 매수 강도" />
                <AlphaBar label="재무 알파" value={financialAlpha} desc="ROE/성장률/안정성" />
                <AlphaBar label="모멘텀 알파" value={momentumAlpha} desc="5일/20일 가격 추세" />
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                  <AlphaBar label="종합 알파" value={compositeAlpha} desc="가중 평균 종합 신호" />
                </div>
              </div>

              {/* AI Critic 리포트 */}
              <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>🤖 AI Critic 종합 분석</p>
              {sections.length > 0 ? (
                sections.map((section, i) => (
                  <div key={i} style={{
                    marginBottom: 16,
                    padding: 16,
                    borderRadius: 10,
                    background: i % 2 === 0 ? '#f8fafc' : '#fff',
                    border: '1px solid #e2e8f0'
                  }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>
                      {section.trim()}
                    </p>
                  </div>
                ))
              ) : (
                <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>{report}</p>
                </div>
              )}

              {/* 데이터 요약 */}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginTop: 16, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📋 데이터 요약</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
<<<<<<< HEAD
                  <div><span style={{ color: '#6b7280' }}>감성: </span><span style={{ fontWeight: 600 }}>긍정 {Math.round((safeAnalysis.sentiment?.positive || 0) * 100)}% / 부정 {Math.round((safeAnalysis.sentiment?.negative || 0) * 100)}%</span></div>
                  <div><span style={{ color: '#6b7280' }}>뉴스 신뢰도: </span><span style={{ fontWeight: 600 }}>{Math.round((safeAnalysis.news_agent_confidence || 0) * 100)}%</span></div>
                  <div><span style={{ color: '#6b7280' }}>분석 뉴스: </span><span style={{ fontWeight: 600 }}>{safeAnalysis.news?.length || 0}건</span></div>
                  <div><span style={{ color: '#6b7280' }}>예측 신뢰구간: </span><span style={{ fontWeight: 600 }}>{finalPred ? `${finalPred.lower?.toLocaleString()} ~ ${finalPred.upper?.toLocaleString()}원` : '-'}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>경고: </span><span style={{ fontWeight: 600, color: safeAnalysis.warnings?.length ? '#EF4444' : '#10B981' }}>{safeAnalysis.warnings?.join(' / ') || '없음'}</span></div>
=======
                  <div><span style={{ color: '#6b7280' }}>감성: </span><span style={{ fontWeight: 600 }}>긍정 {Math.round((analysis?.sentiment?.positive || 0) * 100)}% / 부정 {Math.round((analysis?.sentiment?.negative || 0) * 100)}%</span></div>
                  <div><span style={{ color: '#6b7280' }}>뉴스 신뢰도: </span><span style={{ fontWeight: 600 }}>{Math.round((analysis?.news_agent_confidence || 0) * 100)}%</span></div>
                  <div><span style={{ color: '#6b7280' }}>분석 뉴스: </span><span style={{ fontWeight: 600 }}>{analysis?.news?.length || 0}건</span></div>
                  <div><span style={{ color: '#6b7280' }}>예측 신뢰구간: </span><span style={{ fontWeight: 600 }}>{finalPred ? `${finalPred.lower?.toLocaleString()} ~ ${finalPred.upper?.toLocaleString()}원` : '-'}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#6b7280' }}>경고: </span><span style={{ fontWeight: 600, color: analysis?.warnings?.length ? '#EF4444' : '#10B981' }}>{analysis?.warnings?.join(' / ') || '없음'}</span></div>
>>>>>>> de1cd3335128e74cad3ec41f3b2dba212862cacf
                </div>
              </div>

              {/* 버튼 */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={handleSave} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  📥 리포트 저장 (.txt)
                </button>
                <button onClick={() => setShow(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  닫기
                </button>
              </div>

              <p style={{ margin: '12px 0 0', fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
                ※ 이 리포트는 AI가 자동 생성한 투자 참고용 자료이며 투자 권유가 아닙니다. 투자 결정은 본인 책임입니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DetailReportModal;