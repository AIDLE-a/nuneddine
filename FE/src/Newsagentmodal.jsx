import React, { useState } from 'react';

function NewsAgentModal({ analysis }) {
  const [show, setShow] = useState(false);

  if (!analysis?.news_agent_confidence) return null;

  const confidence = analysis.news_agent_confidence;
  const epistemic = analysis.news_agent_epistemic;
  const aleatoric = analysis.news_agent_aleatoric;
  const report = analysis.news_agent_report || '';

  const getStatus = (val) =>
    val < 0.2 ? { label: '낮음', color: '#10B981', bg: '#dcfce7' } :
    val < 0.5 ? { label: '보통', color: '#F59E0B', bg: '#fef9c3' } :
                { label: '높음', color: '#EF4444', bg: '#fee2e2' };

  const getConfStatus = (val) =>
    val >= 0.85 ? { label: '우수', color: '#10B981', bg: '#dcfce7' } :
    val >= 0.70 ? { label: '양호', color: '#3B82F6', bg: '#dbeafe' } :
    val >= 0.50 ? { label: '보통', color: '#F59E0B', bg: '#fef9c3' } :
                  { label: '낮음', color: '#EF4444', bg: '#fee2e2' };

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
      <button onClick={() => setShow(true)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #3B82F6', background: 'transparent', color: '#3B82F6', cursor: 'pointer', fontWeight: 500 }}>
        뉴스 에이전트 리포트 ↗
      </button>

      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShow(false)}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: '#111827', fontSize: 16 }}>📰 뉴스 에이전트 분석 리포트</h3>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>Uncertainty-aware Agent · Bayesian 불확실성 정량화</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9ca3af' }}>논문: Uncertainty-aware soft sensor using Bayesian recurrent neural networks</p>
              </div>
              <button onClick={() => setShow(false)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>✕</button>
            </div>

            {/* 종합 신뢰도 */}
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>종합 신뢰도</p>
              <div style={{ fontSize: 42, fontWeight: 800, color: confStatus.color, lineHeight: 1 }}>{(confidence * 100).toFixed(0)}%</div>
              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 12, padding: '3px 12px', borderRadius: 20, background: confStatus.bg, color: confStatus.color, fontWeight: 600 }}>{confStatus.label}</span>
              <div style={{ marginTop: 14, background: '#e5e7eb', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{ width: `${confidence * 100}%`, background: confStatus.color, height: 10, borderRadius: 6 }} />
              </div>
            </div>

            {/* Epistemic */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Epistemic Uncertainty</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>인식론적 불확실성 — 데이터 부족으로 인한 불확실성</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: epStatus.color }}>{(epistemic * 100).toFixed(0)}%</div>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: epStatus.bg, color: epStatus.color }}>{epStatus.label}</span>
                </div>
              </div>
              <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, marginBottom: 12 }}>
                <div style={{ width: `${epistemic * 100}%`, background: epStatus.color, borderRadius: 4, height: 6 }} />
              </div>
              {epLines.map((line, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 12, color: '#374151' }}>{line}</p>
              ))}
              <div style={{ background: epStatus.bg, borderRadius: 8, padding: 10, marginTop: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: epStatus.color }}>🔍 분석 이유</p>
                {getEpReason().map((r, i) => <p key={i} style={{ margin: '2px 0', fontSize: 11, color: '#374151' }}>· {r}</p>)}
              </div>
            </div>

            {/* Aleatoric */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Aleatoric Uncertainty</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>우발적 불확실성 — 데이터 자체의 노이즈/혼재</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: alStatus.color }}>{(aleatoric * 100).toFixed(0)}%</div>
                  <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: alStatus.bg, color: alStatus.color }}>{alStatus.label}</span>
                </div>
              </div>
              <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, marginBottom: 12 }}>
                <div style={{ width: `${aleatoric * 100}%`, background: alStatus.color, borderRadius: 4, height: 6 }} />
              </div>
              {alLines.map((line, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 12, color: '#374151' }}>{line}</p>
              ))}
              <div style={{ background: alStatus.bg, borderRadius: 8, padding: 10, marginTop: 10 }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: alStatus.color }}>🔍 분석 이유</p>
                {getAlReason().map((r, i) => <p key={i} style={{ margin: '2px 0', fontSize: 11, color: '#374151' }}>· {r}</p>)}
              </div>
            </div>

            {/* 계산 방식 */}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#374151' }}>📐 신뢰도 계산 방식</p>
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280', lineHeight: 1.8 }}>
                신뢰도 = 1 - (Epistemic × 0.6 + Aleatoric × 0.4)<br/>
                Epistemic: 뉴스 수(35%) + 출처 다양성(25%) + 최신성(25%) + 주요언론(15%)<br/>
                Aleatoric: description 보유(35%) + 최신성(25%) + 중복(25%) + 제목 품질(15%)
              </p>
            </div>

            {/* 최종 판단 */}
            <div style={{ background: confidence >= 0.8 ? '#dcfce7' : confidence >= 0.6 ? '#fef9c3' : '#fee2e2', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: confidence >= 0.8 ? '#166534' : confidence >= 0.6 ? '#854d0e' : '#991b1b' }}>
                {confidence >= 0.8 ? '✅ 데이터 충분, 분석 신뢰도 높음' : confidence >= 0.6 ? '⚠️ 데이터 보통, 추가 확인 권장' : '❌ 데이터 부족, 신뢰도 낮음'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
                {confidence >= 0.8 ? '이 분석 결과를 참고 지표로 활용하기에 적합합니다.' : confidence >= 0.6 ? '주요 내용은 참고 가능하나 추가 정보 확인을 권장합니다.' : '데이터 부족으로 인해 분석 결과의 신뢰도가 낮습니다.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NewsAgentModal;