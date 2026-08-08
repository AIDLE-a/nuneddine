import React, { useState } from 'react';

// 개별 판단 근거 카드. url이 있으면 원문 뉴스로 이동하는 링크로 감쌈.
function InsightItem({ item, isPositive }) {
  const hasLink = Boolean(item.url) && item.url !== '#';

  const content = (
    <div
      style={{
        background: isPositive ? 'var(--positive-light)' : 'var(--negative-light)',
        border: `1px solid ${isPositive ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
        borderRadius: '12px',
        padding: '12px',
      }}
    >
      <div style={{ marginBottom: '6px' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: '700',
            color: isPositive ? 'var(--positive)' : 'var(--negative)',
            background: isPositive ? 'var(--positive-light)' : 'var(--negative-light)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {isPositive ? '🟢 주요 호재' : '🔴 주요 악재'}
        </span>
      </div>
      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
        {item.title || item.summary || item.word}
      </p>
      {item.source_title && (
        <p style={{ margin: 0, fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
          {hasLink && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
          {item.source_title}
        </p>
      )}
    </div>
  );

  if (hasLink) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {content}
      </a>
    );
  }
  return content;
}

// 상세보기 클릭 시 뜨는 모달: 호재/악재 탭 + 계산 방식 설명
// ▼ 변경점: 화면 하단(bottom sheet)이 아니라 화면 중앙에 뜨도록 수정
function DetailModal({ positiveItems, negativeItems, calculationNote, onClose }) {
  const [tab, setTab] = useState('positive');
  const active = tab === 'positive' ? positiveItems : negativeItems;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',       // ← 'flex-end'에서 변경: 세로 중앙 정렬
        justifyContent: 'center',   // 가로 중앙 정렬 (기존 유지)
        zIndex: 1000,
        padding: '20px',            // 작은 화면에서 모달이 가장자리에 붙지 않도록 여백
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          width: '100%',
          maxWidth: '480px',
          borderRadius: '20px',     // ← 상단만 둥글던 것을 사방 둥글게 변경
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', // 중앙 모달에 어울리는 그림자 추가
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
            판단 근거 상세보기
          </h4>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: '18px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* 호재 / 악재 탭 */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 0' }}>
          <button
            onClick={() => setTab('positive')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              background: tab === 'positive' ? 'var(--positive)' : 'var(--surface-2)',
              color: tab === 'positive' ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            🟢 호재 {positiveItems.length}
          </button>
          <button
            onClick={() => setTab('negative')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              background: tab === 'negative' ? 'var(--negative)' : 'var(--surface-2)',
              color: tab === 'negative' ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            🔴 악재 {negativeItems.length}
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {active.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              해당 항목이 없습니다.
            </p>
          ) : (
            active.map((item, idx) => (
              <InsightItem key={idx} item={item} isPositive={tab === 'positive'} />
            ))
          )}

          {/* 긍정/부정 비율 계산 방식 설명 */}
          {calculationNote && (
            <div style={{ marginTop: '8px', background: 'var(--surface-2)', borderRadius: '10px', padding: '12px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                비율은 이렇게 계산돼요
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {calculationNote}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SentimentCard({ analysis }) {
  const [showDetail, setShowDetail] = useState(false);

  if (!analysis) return null;

  const totalCount = analysis.news?.length || analysis.total_news_count || 0;
  const posPercent = Math.round((analysis.sentiment?.positive || 0) * 100);
  const negPercent = Math.round((analysis.sentiment?.negative || 0) * 100);

  // 백엔드에서 실제 분석된 총평이 있는지 확인
  const rawSummary = analysis.top_keywords || analysis.ai_summary;
  const hasRealSummary = rawSummary && rawSummary !== "뉴스 데이터를 종합 분석 중입니다.";

  // 백엔드에서 넘어온 실제 호재/악재 근거 데이터 (전체)
  const positiveItems = analysis.explanation?.filter(item => item.type === 'positive' || item.contribution > 0) || [];
  const negativeItems = analysis.explanation?.filter(item => item.type === 'negative' || item.contribution < 0) || [];

  // 기본 화면에는 호재 2개 / 악재 2개만 노출
  const visiblePositive = positiveItems.slice(0, 2);
  const visibleNegative = negativeItems.slice(0, 2);
  const totalInsightCount = positiveItems.length + negativeItems.length;

  return (
    <div className="card">
      {/* 1. 상단 감성 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>감성 분석</h3>
        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', fontWeight: '600' }}>
          <span style={{ color: 'var(--positive)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '12px' }}>
            긍정 {posPercent}%
          </span>
          <span style={{ color: 'var(--negative)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '3px 10px', borderRadius: '12px' }}>
            부정 {negPercent}%
          </span>
        </div>
      </div>

      {/* 2. AI 한 줄 브리핑 박스 */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>
            AI 분석 총평
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            총 {totalCount}건 뉴스 분석
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', fontWeight: '500' }}>
          "{hasRealSummary ? rawSummary : '최근 수집된 뉴스를 기반으로 심층 감성 분석을 진행했습니다.'}"
        </p>
      </div>

      {/* 3. 주요 판단 근거 */}
      {(positiveItems.length > 0 || negativeItems.length > 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              주요 판단 근거
            </span>
            <button
              onClick={() => setShowDetail(true)}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '11px',
                fontWeight: '700',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                padding: 0,
              }}
            >
              상세보기 ({totalInsightCount}) ›
            </button>
          </div>

          {/* 🟢 주요 호재 카드 (최대 2개) */}
          {visiblePositive.map((item, idx) => (
            <InsightItem key={`pos-${idx}`} item={item} isPositive={true} />
          ))}

          {/* 🔴 주요 악재 카드 (최대 2개) */}
          {visibleNegative.map((item, idx) => (
            <InsightItem key={`neg-${idx}`} item={item} isPositive={false} />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0 0' }}>
          ※ 세부 뉴스 키워드 분석 결과는 백엔드 분석 완료 후 업데이트됩니다.
        </p>
      )}

      {showDetail && (
        <DetailModal
          positiveItems={positiveItems}
          negativeItems={negativeItems}
          calculationNote={analysis.calculation_note}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}

export default SentimentCard;