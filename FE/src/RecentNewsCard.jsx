import React, { useState } from 'react';

const PAYWALLED_DOMAINS = ['wsj.com', 'ft.com', 'bloomberg.com', 'economist.com', 'nytimes.com'];

function isPaywalled(url) {
  return PAYWALLED_DOMAINS.some(domain => url?.includes(domain));
}

function getSearchUrl(title) {
  return `https://www.google.com/search?q=${encodeURIComponent(title)}`;
}

function RecentNewsCard({ stock, analysis }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 5;

  const allNews = analysis
    ? analysis.news.map(n => ({
        title: n.title,
        source: n.source,
        time: new Date(n.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        url: n.url,
      }))
    : (stock?.news || []).map(n => ({
        title: n.title,
        source: n.source,
        time: n.published_at,
        url: n.url,
      }));

  const visibleNews = showAll ? allNews : allNews.slice(0, INITIAL_COUNT);
  const hasMore = allNews.length > INITIAL_COUNT;

  return (
    <div className="card news-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>● 최근 뉴스</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>총 {allNews.length}건</span>
      </div>

      {/* 뉴스 리스트 — 더보기 시 스크롤 박스 */}
      <div style={showAll ? {
        overflowY: 'auto', maxHeight: 480,
        borderRadius: 8, border: '1px solid #e5e7eb',
        padding: '4px 0',
      } : {}}>
        {allNews.length === 0 ? (
          <p className="text-muted">뉴스가 없습니다.</p>
        ) : (
          visibleNews.map((item, i) => (
            <div key={i} className="news-item" style={showAll ? { padding: '10px 14px', borderBottom: i < visibleNews.length - 1 ? '1px solid #f3f4f6' : 'none' } : {}}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
                <a href={isPaywalled(item.url) ? getSearchUrl(item.title) : item.url}
                  target="_blank" rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                  {item.title}
                </a>
            
              </h4>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{item.time} · {item.source}</span>
                <a href={getSearchUrl(item.title)} target="_blank" rel="noreferrer"
                  style={{ fontSize: 10, color: 'var(--text-muted)', textDecoration: 'underline' }}>
                  🔍 Google
                </a>
              </p>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <button onClick={() => setShowAll(!showAll)}
          style={{
            width: '100%', marginTop: 10, padding: '8px 0',
            borderRadius: 8, border: '1px solid #e5e7eb',
            background: 'transparent', cursor: 'pointer',
            fontSize: 12, color: 'var(--text-muted)', fontWeight: 500,
          }}>
          {showAll ? '접기 ↑' : `더보기 (${allNews.length - INITIAL_COUNT}건 더) ↓`}
        </button>
      )}
    </div>
  );
}

export default RecentNewsCard;