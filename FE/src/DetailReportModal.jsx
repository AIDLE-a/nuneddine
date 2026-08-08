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

  const report = safeAnalysis.critic_report || 'AI Critic 리포트를 생성 중이거나 데이터가 부족합니다.';

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


  const getConfColor = (score) =>
    score >= 70 ? 'var(--positive)' : score >= 50 ? '#F59E0B' : 'var(--negative)';

  const getAlphaColor = (val) =>
    val > 0.2 ? 'var(--positive)' : val < -0.2 ? 'var(--negative)' : '#F59E0B';

  const getSignal = (val) =>
    val > 0.4 ? '강한매수' : val > 0.2 ? '매수' : val < -0.4 ? '강한매도' : val < -0.2 ? '매도' : '중립';

  const AlphaBar = ({ label, value, desc }) => {
    const pct = Math.round((value + 1) / 2 * 100);
    const color = getAlphaColor(value);
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</span>
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
  누네띄네 AI 주식 리서치 리포트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

종목명: ${safeStock.name} (${safeStock.code})
분석일시: ${dateStr}
현재가: ${safeAnalysis.price?.toLocaleString() || '-'}원
7일 예측가: ${finalPred ? finalPred.future_price?.toLocaleString() + '원' : '-'}
현재가: ${analysis?.price?.toLocaleString()}원
7일 예측가: ${finalPred ? finalPred.future_price.toLocaleString() + '원' : '-'}
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
감성: 긍정 ${Math.round((safeAnalysis.sentiment?.positive || 0) * 100)}% / 부정 ${Math.round((safeAnalysis.sentiment?.negative || 0) * 100)}%
뉴스 신뢰도: ${Math.round((safeAnalysis.news_agent_confidence || 0) * 100)}%
분석 뉴스: ${safeAnalysis.news?.length || 0}건
경고: ${safeAnalysis.warnings?.join(' / ') || '없음'}
감성: 긍정 ${Math.round(analysis?.sentiment?.positive * 100)}% / 부정 ${Math.round(analysis?.sentiment?.negative * 100)}%
뉴스 신뢰도: ${Math.round((analysis?.news_agent_confidence || 0) * 100)}%
분석 뉴스: ${analysis?.news?.length || 0}건
경고: ${analysis?.warnings?.join(' / ') || '없음'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
※ 이 리포트는 AI가 자동 생성한 투자 참고용 자료이며
  투자 권유가 아닙니다. 투자 결정은 본인 책임입니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `누네띄네_${safeStock.name}_${now.toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderReport = (text) => {
    const lines = text.split('\n');
    const result = [];
    lines.forEach((line, i) => {
      const stripped = line.replace(/\*\*(.*?)\*\*/g, '$1').trimEnd();
      const trimmed = stripped.trim();

      // Standalone heading line ending with : (e.g. "요약:")
      if (/^[^:：]{1,20}[：:]$/.test(trimmed)) {
        result.push(
          <strong key={`h${i}`} style={{ display: 'block', color: 'var(--text-primary)', marginTop: result.length > 0 ? 10 : 0, fontSize: 12 }}>
            {trimmed}
          </strong>
        );
        return;
      }

      // Inline heading: "제목: content" → split heading + content
      const inlineHeading = trimmed.match(/^([^:：\n]{1,15}[：:])\s+(.+)$/);
      if (inlineHeading) {
        result.push(
          <span key={`ih${i}`}>
            <strong style={{ display: 'block', color: 'var(--text-primary)', marginTop: result.length > 0 ? 10 : 0, fontSize: 12 }}>
              {inlineHeading[1]}
            </strong>
            <span style={{ display: 'block', lineHeight: 1.7 }}>{inlineHeading[2]}</span>
          </span>
        );
        return;
      }

      // Regular line
      const parts = stripped.split(/\*\*(.*?)\*\*/g);
      result.push(
        <span key={i} style={{ display: 'block', lineHeight: 1.7 }}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
        </span>
      );
    });
    return result;
  };

  const SECTION_EMOJI_RE = /^(📰|📊|💡|🔮|⚡|⚠️)\s*/u;
  const SECTION_META = {
    '📰': { label: '뉴스 분석', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
    '📊': { label: '퀀트 분석', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    '💡': { label: '인사이트', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
    '🔮': { label: '예측 분석', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    '⚡': { label: '모멘텀', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
    '⚠️': { label: '경고', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  };
  const rawSections = report.split(/(?=📰|📊|💡|🔮|⚡|⚠️)/).filter(s => s.trim());
  const sections = rawSections.map(s => {
    const m = s.match(SECTION_EMOJI_RE);
    const meta = m ? SECTION_META[m[1]] : null;
    return { label: meta?.label || null, icon: meta?.icon || null, text: s.replace(SECTION_EMOJI_RE, '').trim() };
  });

  return (
    <>
      <button onClick={() => setShow(true)} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        상세 리포트
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </button>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal-box" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="modal-header">
              <h3>{safeStock.name} 상세 리포트</h3>
              <button onClick={() => setShow(false)} className="modal-close">✕</button>
            </div>

            {/* 핵심 지표 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: '현재가', value: safeAnalysis.price ? `${safeAnalysis.price.toLocaleString()}원` : '-', color: 'var(--text-primary)' },
                { label: '종합 신뢰도', value: `${confidence}/100`, color: getConfColor(confidence) },
                { label: '종합 알파', value: `${compositeAlpha > 0 ? '+' : ''}${compositeAlpha.toFixed(3)}`, color: getAlphaColor(compositeAlpha) },
              ].map((item, i) => (
                <div key={i} className="modal-section" style={{ margin: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* 알파 신호 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>종합 투자 신호:</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: getAlphaColor(compositeAlpha) + '22', color: getAlphaColor(compositeAlpha), border: `1px solid ${getAlphaColor(compositeAlpha)}44` }}>
                {getSignal(compositeAlpha)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(감성 30% + 수급 30% + 재무 20% + 모멘텀 20%)</span>
            </div>

            {/* 본문 */}
            <div className="modal-body">

              {/* 알파 팩터 */}
              <div className="modal-section">
                <p className="modal-section-title">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  퀀트 알파 팩터 분석
                </p>
                <AlphaBar label="감성 알파" value={sentimentAlpha} desc="뉴스 긍정/부정 신호" />
                <AlphaBar label="수급 알파" value={flowAlpha} desc="외국인/기관 매수 강도" />
                <AlphaBar label="재무 알파" value={financialAlpha} desc="ROE/성장률/안정성" />
                <AlphaBar label="모멘텀 알파" value={momentumAlpha} desc="5일/20일 가격 추세" />
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <AlphaBar label="종합 알파" value={compositeAlpha} desc="가중 평균 종합 신호" />
                </div>
              </div>

              {/* AI Critic 리포트 */}
              <p className="modal-section-title" style={{ marginBottom: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
                AI Critic 종합 분석
              </p>
              {rawSections.length > 0 ? (
                sections.map((section, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 14, borderRadius: 10, background: i % 2 === 0 ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--border)' }}>
                    {section.icon && (
                      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {section.icon}{section.label}
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{renderReport(section.text)}</p>
                  </div>
                ))
              ) : (
                <div className="modal-section">
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 500, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{renderReport(report)}</p>
                </div>
              )}

              {/* 데이터 요약 */}
              <div className="modal-section" style={{ marginTop: 16 }}>
                <p className="modal-section-title">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  데이터 요약
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12, fontWeight: 500 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>감성: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>긍정 {Math.round((safeAnalysis.sentiment?.positive || 0) * 100)}% / 부정 {Math.round((safeAnalysis.sentiment?.negative || 0) * 100)}%</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>뉴스 신뢰도: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.round((safeAnalysis.news_agent_confidence || 0) * 100)}%</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>분석 뉴스: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{safeAnalysis.news?.length || 0}건</span></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>예측 신뢰구간: </span><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{finalPred ? `${finalPred.lower?.toLocaleString()} ~ ${finalPred.upper?.toLocaleString()}원` : '-'}</span></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>경고: </span><span style={{ fontWeight: 600, color: safeAnalysis.warnings?.length ? 'var(--negative)' : 'var(--positive)' }}>{safeAnalysis.warnings?.join(' / ') || '없음'}</span></div>
                </div>
              </div>

              {/* 버튼 */}
              <div className="modal-action-row">
                <button onClick={handleSave} className="btn-modal-primary">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  리포트 저장 (.txt)
                </button>
                <button onClick={() => setShow(false)} className="btn-modal-secondary">닫기</button>
              </div>

              <p style={{ margin: '12px 0 0', fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                ※ 이 리포트는 AI가 자동 생성한 투자 참고용 자료이며 투자 권유가 아닙니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DetailReportModal;