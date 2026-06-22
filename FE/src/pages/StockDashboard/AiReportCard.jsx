import React from 'react';

function AiReportCard() {
  return (
    <div className="card report-section">
      <h3>AI 리포트 <span className="text-muted font-normal">Critic Agent 검토 완료</span></h3>
      <p className="report-text">
        삼성전자는 HBM4 양산 일정 조기 착수를 발표하며 AI 메모리 시장에서의 기술 주도권 강화 의지를 확인했습니다. 외국인 순매수 흐름이 3거래일 지속되고 있어 단기 수급은 긍정적으로 판단됩니다.
      </p>
      <div className="report-alert-box">
        <span>단, 메모리 수요 둔화에 관한 뉴스가 부정적 신호를 동시에 발생시키고 있으며</span>
        <span className="alert-badge">⚠ 근거 부족</span>
        <span>이 구간의 예측 신뢰도는 제한적입니다.</span>
      </div>
      <div className="report-buttons">
        <button className="btn-secondary">경고 문구 상세 ↗</button>
        <button className="btn-secondary">과거 비교 ↗</button>
        <button className="btn-secondary">내보내기 ↗</button>
      </div>
    </div>
  );
}

export default AiReportCard;