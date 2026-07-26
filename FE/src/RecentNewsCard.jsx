import React, { useState } from 'react';

const PAYWALLED_DOMAINS = ['wsj.com', 'ft.com', 'bloomberg.com', 'economist.com', 'nytimes.com'];

function isPaywalled(url) {
  return PAYWALLED_DOMAINS.some(domain => url.includes(domain));
}

function getSearchUrl(title) {
  return `https://www.google.com/search?q=${encodeURIComponent(title)}`;
}

function NewsLink({ url, title, children }) {
  const href = isPaywalled(url) ? getSearchUrl(title) : url;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>
      {children}
    </a>
  );
}

function RecentNewsCard({ stock, analysis }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 5;

  const allNews = analysis
    ? analysis.news.map(n => ({
        title: n.title,
        source: n.source,
        time: new Date(n.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
        sentiment: null,
        url: n.url,
      }))
    : stock.news.map(n => ({
        title: n.title,
        source: n.source,
        time: n.published_at,
        sentiment: n.sentiment,
        url: n.url,
      }));

  const newsList = showAll ? allNews : allNews.slice(0, INITIAL_COUNT);
  const hasMore = allNews.length > INITIAL_COUNT;

  return (
    <div className="card news-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>최근 뉴스</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          총 {allNews.length}건
        </span>
      </div>

      <div className="news-list">
        {newsList.length === 0 ? (
          <p className="text-muted">뉴스가 없습니다.</p>
        ) : (
          <>
            {newsList.map((item, i) => (
              <div key={i} className="news-item">
                <h4>
                  <NewsLink url={item.url} title={item.title}>
                    {item.title}
                  </NewsLink>
                  {item.sentiment && (
                    <span className={`badge ${item.sentiment === 'positive' ? 'positive' : 'negative'}`}
                      style={{ marginLeft: 6, flexShrink: 0 }}>
                      {item.sentiment === 'positive' ? '긍정' : '부정'}
                    </span>
                  )}
                </h4>
                <p className="text-muted news-meta"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 0' }}>
                  <span>{item.time} · {item.source}</span>
                  {!isPaywalled(item.url) && (
                    <a href={getSearchUrl(item.title)} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'underline', flexShrink: 0 }}>
                      🔍 Google
                    </a>
                  )}
                </p>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                style={{
                  width: '100%', marginTop: 12, padding: '8px 0',
                  borderRadius: 8, border: '1px solid var(--border-color, #e5e7eb)',
                  background: 'transparent', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                {showAll
                  ? '접기 ↑'
                  : `더보기 (${allNews.length - INITIAL_COUNT}건 더) ↓`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default RecentNewsCard;