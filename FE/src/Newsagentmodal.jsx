import React, { useState } from 'react';

function NewsAgentModal({ analysis }) {
  const [show, setShow] = useState(false);

  if (!analysis?.news_agent_confidence) return null;

  const confidence = analysis.news_agent_confidence;
  const epistemic = analysis.news_agent_epistemic;
  const aleatoric = analysis.news_agent_aleatoric;
  const report = analysis.news_agent_report || '';

  const getStatus = (val) =>
    val < 0.2 ? { label: '낮음', color: 'var(--accent)', bg: 'var(--accent-bg)' } :
    val < 0.5 ? { label: '보통', color: 'var(--accent)', bg: 'var(--accent-bg)' } :
                { label: '높음', color: 'var(--negative)', bg: '#fee2e2' };

  const getConfStatus = (val) =>
    val >= 0.85 ? { label: '우수', color: 'var(--accent)', bg: 'var(--accent-bg)' } :
    val >= 0.70 ? { label: '양호', color: 'var(--accent)', bg: 'var(--accent-bg)' } :
    val >= 0.50 ? { label: '보통', color: 'var(--accent)', bg: 'var(--accent-bg)' } :
                  { label: '낮음', color: 'var(--negative)', bg: '#fee2e2' };

  const epStatus = getStatus(epistemic);
  const alStatus = getStatus(aleatoric);
  const confStatus = getConfStatus(confidence);

  const allLines = report.split(' | ').map(l => l.trim()).filter(l =>
    l && !l.startsWith('╔') && !l.startsWith('╠') && !l.startsWith('╚') &&
    !l.startsWith('║') && !l.includes('Epistemic') && !l.includes('Aleatoric') &&
    !l.includes('신뢰도') && !l.includes('판단') && !l.includes('Uncertainty')
  );

  const epLines = allLines.filter(l =>
    l.includes('뉴스 수') || l.includes('출처') || l.includes('24h') || l.includes('주요언론')
  );
  const alLines = allLines.filter(l =>
    l.includes('description') || l.includes('7일이상') || l.includes('중복') || l.includes('짧은')
  );

  const getEpReason = () => {
    if (epistemic < 0.2) return [
      "데이터가 충분하고 다양한 출처에서 수집됐어요.",
      "최신 뉴스 비율이 높아 시의성이 좋아요."
    ];
    if (epistemic < 0.5) return [
      "데이터는 있지만 보완이 필요해요.",
      "주요 언론사 비율을 높이면 신뢰도가 올라가요."
    ];
    return ["데이터가 부족해서 분석 신뢰도가 낮아요.", "더 많은 뉴스 수집이 필요해요."];
  };

  const getAlReason = () => {
    if (aleatoric < 0.2) return [
      "뉴스 품질이 좋고 노이즈가 적어요.",
      "중복 기사가 적고 내용이 충실해요."
    ];
    if (aleatoric < 0.5) return [
      "일부 뉴스에 요약(description)이 없어요.",
      "description 보완 시 감성 분석 정확도가 높아져요."
    ];
    return ["뉴스 품질에 노이즈가 많아요.", "중복 기사나 오래된 정보가 섞여 있어요."];
  };

  return (
    <>
      <button onClick={() => setShow(true)} className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        뉴스 에이전트 리포트
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </button>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>

            <div className="modal-header">
              <h3>뉴스 에이전트 분석 리포트</h3>
              <button onClick={() => setShow(false)} className="modal-close">✕</button>
            </div>

            <div className="modal-body">

              {/* 종합 신뢰도 */}
              <div className="modal-section" style={{ textAlign: 'center', marginBottom: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>종합 신뢰도</p>
                <div style={{ fontSize: 40, fontWeight: 800, color: confStatus.color, lineHeight: 1 }}>{(confidence * 100).toFixed(0)}%</div>
                <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12, padding: '3px 14px', borderRadius: 20, background: confStatus.bg, color: confStatus.color, fontWeight: 600 }}>{confStatus.label}</span>
                <div style={{ marginTop: 14, background: 'var(--border)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${confidence * 100}%`, background: confStatus.color, height: 8, borderRadius: 6 }} />
                </div>
              </div>

              {/* Epistemic */}
              <div className="modal-section" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Epistemic Uncertainty</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>인식론적 불확실성 — 데이터 부족으로 인한 불확실성</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: epStatus.color }}>{(epistemic * 100).toFixed(0)}%</div>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: epStatus.bg, color: epStatus.color }}>{epStatus.label}</span>
                  </div>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: 10 }}>
                  <div style={{ width: `${epistemic * 100}%`, background: epStatus.color, borderRadius: 4, height: 6 }} />
                </div>
                {epLines.map((line, i) => <p key={i} style={{ margin: '3px 0', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{line}</p>)}
                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 10, marginTop: 10, border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: epStatus.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    분석 이유
                  </p>
                  {getEpReason().map((r, i) => <p key={i} style={{ margin: '2px 0', fontSize: 11, color: 'var(--text-secondary)' }}>· {r}</p>)}
                </div>
              </div>

              {/* Aleatoric */}
              <div className="modal-section" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Aleatoric Uncertainty</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>우발적 불확실성 — 데이터 자체의 노이즈/혼재</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: alStatus.color }}>{(aleatoric * 100).toFixed(0)}%</div>
                    <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: alStatus.bg, color: alStatus.color }}>{alStatus.label}</span>
                  </div>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, marginBottom: 10 }}>
                  <div style={{ width: `${aleatoric * 100}%`, background: alStatus.color, borderRadius: 4, height: 6 }} />
                </div>
                {alLines.map((line, i) => <p key={i} style={{ margin: '3px 0', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{line}</p>)}
                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: 10, marginTop: 10, border: '1px solid var(--border)' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: alStatus.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    분석 이유
                  </p>
                  {getAlReason().map((r, i) => <p key={i} style={{ margin: '2px 0', fontSize: 11, color: 'var(--text-secondary)' }}>· {r}</p>)}
                </div>
              </div>

              {/* 계산 방식 */}
              <div className="modal-section" style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                  신뢰도 계산 방식
                </p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  신뢰도 = 1 - (Epistemic × 0.6 + Aleatoric × 0.4)<br/>
                  Epistemic: 뉴스 수(35%) + 출처 다양성(25%) + 최신성(25%) + 주요언론(15%)<br/>
                  Aleatoric: description 보유(35%) + 최신성(25%) + 중복(25%) + 제목 품질(15%)
                </p>
              </div>

              {/* 최종 판단 */}
              <div className="report-alert-box">
                <span>{confidence >= 0.8 ? '신뢰도 높음' : confidence >= 0.6 ? '추가 확인 권장' : '신뢰도 낮음'}</span>
                <span className="alert-badge">⚠ {confStatus.label}</span>
                <span>{confidence >= 0.8 ? '참고 지표로 활용하기에 적합합니다.' : confidence >= 0.6 ? '추가 정보 확인을 권장합니다.' : '분석 결과의 신뢰도가 낮습니다.'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NewsAgentModal;