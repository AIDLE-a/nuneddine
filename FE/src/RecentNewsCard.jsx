import React from 'react';

const PAYWALLED_DOMAINS = ['wsj.com', 'ft.com', 'bloomberg.com', 'economist.com', 'nytimes.com'];

function isPaywalled(url) {
  return PAYWALLED_DOMAINS.some(domain => url?.includes(domain));
}

function getSearchUrl(title) {
  return `https://www.google.com/search?q=${encodeURIComponent(title)}`;
}

function RecentNewsCard({ stock, analysis }) {
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

  return (
    <div className="card news-section" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
        <h3 style={{ margin: 0 }}>최근 뉴스</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>총 {allNews.length}건</span>
      </div>

      {allNews.length === 0 ? (
        <p className="text-muted">뉴스가 없습니다.</p>
      ) : (
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
          {allNews.map((item, i) => (
            <div key={i} className="news-item">
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
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecentNewsCard;
