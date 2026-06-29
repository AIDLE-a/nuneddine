import React from 'react';

// 유료 구독 / 접근 제한이 잦은 도메인 목록
const PAYWALLED_DOMAINS = ['wsj.com', 'ft.com', 'bloomberg.com', 'economist.com', 'nytimes.com'];

function isPaywalled(url) {
  return PAYWALLED_DOMAINS.some(domain => url.includes(domain));
}

function getSearchUrl(title) {
  return `https://www.google.com/search?q=${encodeURIComponent(title)}`;
}

function NewsLink({ url, title, children }) {
  // 유료 구독 도메인이면 바로 Google 검색으로
  const href = isPaywalled(url) ? getSearchUrl(title) : url;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
    >
      {children}
    </a>
  );
}

function RecentNewsCard({ stock, analysis }) {
  const newsList = analysis
    ? analysis.news.slice(0, 5).map(n => ({
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

  return (
    <div className="card news-section">
      <h3>최근 뉴스</h3>
      <div className="news-list">
        {newsList.length === 0 ? (
          <p className="text-muted">뉴스가 없습니다.</p>
        ) : (
          newsList.map((item, i) => (
            <div key={i} className="news-item">
              <h4>
                <NewsLink url={item.url} title={item.title}>
                  {item.title}
                </NewsLink>
                {item.sentiment && (
                  <span className={`badge ${item.sentiment === 'positive' ? 'positive' : 'negative'}`} style={{ marginLeft: 6, flexShrink: 0 }}>
                    {item.sentiment === 'positive' ? '긍정' : '부정'}
                  </span>
                )}
              </h4>
              <p className="text-muted news-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 0' }}>
                <span>{item.time} · {item.source}</span>
                {!isPaywalled(item.url) && (
                  <a
                    href={getSearchUrl(item.title)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'underline', flexShrink: 0 }}
                  >
                    🔍 Google
                  </a>
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RecentNewsCard;
