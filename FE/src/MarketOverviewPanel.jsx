import React, { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:8000';

function MarketOverviewPanel({ onAnalyze }) {
  const [data, setData] = useState({ rising: [], falling: [], popular: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/market-overview`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleClick = (item) => {
    if (onAnalyze) {
      onAnalyze({
        code: item.ticker,
        name: item.name,
        price: item.price ? `${item.price.toLocaleString()}원` : '-',
        change: item.change_pct ? `${item.change_pct > 0 ? '+' : ''}${item.change_pct}%` : '-',
        isPositive: (item.change_pct || 0) >= 0,
      });
    }
  };

  const Section = ({ title, items, type, accentColor }) => (
    <div className="card" style={{ padding: '16px', flex: 1, minWidth: 0 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{title}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{items.length}개</span>
      </div>

      {/* 리스트 */}
      <div style={{ overflowY: 'auto', maxHeight: 380, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '20px 0' }}>로딩 중...</p>
        ) : items.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '20px 0' }}>데이터 없음</p>
        ) : items.map((item, i) => (
          <div key={i} onClick={() => handleClick(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid #f3f4f6', background: '#fafafa',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
            onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}>

            {/* 순위 뱃지 */}
            <span style={{
              minWidth: 20, height: 20, borderRadius: '50%',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              background: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : '#e5e7eb',
              color: i < 3 ? '#fff' : '#6b7280',
            }}>{i + 1}</span>

            {/* 종목명 + 가격 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name}
              </p>
              {type !== 'popular' && item.price && (
                <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>
                  {item.price.toLocaleString()}원
                </p>
              )}
              {type === 'popular' && (
                <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>
                  분석 {item.count}회
                </p>
              )}
            </div>

            {/* 등락률 */}
            {type !== 'popular' && (
              <span style={{
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                color: (item.change_pct || 0) >= 0 ? '#10B981' : '#EF4444',
              }}>
                {(item.change_pct || 0) > 0 ? '+' : ''}{item.change_pct}%
              </span>
            )}
            {type === 'popular' && (
              <span style={{ fontSize: 13, flexShrink: 0 }}>🔥</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
      <Section title="📈 급상승" items={data.rising || []} type="rising" accentColor="#10B981" />
      <Section title="📉 급하락" items={data.falling || []} type="falling" accentColor="#EF4444" />
      <Section title="👥 많이 분석한 종목" items={data.popular || []} type="popular" accentColor="#F59E0B" />
    </div>
  );
}

export default MarketOverviewPanel;