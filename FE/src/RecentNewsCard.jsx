import React from 'react';

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
                <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {item.title}
                </a>
                {item.sentiment && (
                  <span className={`badge ${item.sentiment === 'positive' ? 'positive' : 'negative'}`}>
                    {item.sentiment === 'positive' ? '긍정' : '부정'}
                  </span>
                )}
              </h4>
              <p className="text-muted">{item.time} · {item.source}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RecentNewsCard;
