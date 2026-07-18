import React, { useState } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, BarChart
} from 'recharts';
import { isKoreanStock } from './currencyUtils.js';

const DAYS = ['7일전', '6일전', '5일전', '4일전', '3일전', '2일전', '어제'];

function StockChartCard({ stock, analysis }) {
  const [showPriceDetail, setShowPriceDetail] = useState(false);
  const [showVolumeDetail, setShowVolumeDetail] = useState(false);
  const isKorean = isKoreanStock(stock, analysis);

  const allPrices = (analysis?.price_history?.length)
    ? analysis.price_history : stock.chartData;
  const allVolumes = analysis?.volume_history || [];
  const investorData = analysis?.investor_data || [];

  const historyPrices = allPrices.slice(-7);
  const historyVolumes = allVolumes.slice(-7);

  const formatPrice = (v) => isKorean ? `${(v / 1000).toFixed(0)}k` : `$${v}`;
  const formatVolume = (v) => {
    if (!v) return '–';
    return Math.abs(v).toLocaleString();
  };
  const formatFlow = (v) => {
    if (v == null) return '–';
    const prefix = v > 0 ? '+' : '';
    return prefix + Math.round(v).toLocaleString();
  };

  const priceData = historyPrices.map((price, i) => ({
    day: DAYS[i] ?? `${historyPrices.length - i}일전`,
    price, predicted: null,
  }));

  const predictionDays = analysis?.prediction ?? [];
  if (analysis && predictionDays.length > 0) {
    const lastPrice = historyPrices[historyPrices.length - 1];
    priceData[priceData.length - 1].predicted = lastPrice;
    predictionDays.forEach((p) => {
      priceData.push({ day: `D+${p.day}`, price: null, predicted: p.future_price });
    });
  }

  const allValues = priceData.flatMap(d => [d.price, d.predicted].filter(v => v != null));
  const minVal = Math.floor(Math.min(...allValues) * 0.995);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.005);

  const volumeData = historyPrices.map((_, i) => ({
    day: DAYS[i] ?? `${historyPrices.length - i}일전`,
    volume: historyVolumes[i] || 0,
  }));

  const priceTableData = allPrices.map((price, i) => {
    const daysAgo = allPrices.length - 1 - i;
    const label = daysAgo === 0 ? '어제' : `${daysAgo}일전`;
    const prevPrice = i > 0 ? allPrices[i - 1] : null;
    const change = prevPrice ? price - prevPrice : null;
    const changePct = prevPrice ? ((price - prevPrice) / prevPrice * 100) : null;
    return { label, price, change, changePct, volume: allVolumes[i] || 0 };
  }).reverse();

  const ModalWrapper = ({ onClose, children }) => (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 700, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  const CloseBtn = ({ onClose }) => (
    <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
  );

  const PriceTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload.find(p => p.dataKey === 'price' || p.dataKey === 'predicted')?.value;
    const isPredict = typeof label === 'string' && label.startsWith('D+');
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <p style={{ margin: '0 0 4px', color: '#6b7280' }}>{label}</p>
        {val != null && <p style={{ margin: 0, fontWeight: 600, color: isPredict ? '#F59E0B' : '#111827' }}>
          {isKorean ? `${val.toLocaleString()}원` : `$${val.toLocaleString()}`}
        </p>}
        {isPredict && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>Prophet 예측</p>}
      </div>
    );
  };

  const VolumeTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const vol = payload[0]?.value;
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <p style={{ margin: '0 0 4px', color: '#6b7280' }}>{label}</p>
        {vol != null && <p style={{ margin: 0, fontWeight: 600, color: '#10B981' }}>거래량: {vol.toLocaleString()}주</p>}
      </div>
    );
  };

  return (
    <>
      <div className="card chart-section">
        {/* 주가 차트 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>주가 흐름 & 예측 (7일)</h3>
          <button onClick={() => setShowPriceDetail(true)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
            전체 기간 상세 ↗
          </button>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={priceData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} />
            <YAxis domain={[minVal, maxVal]} tickFormatter={formatPrice} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} width={48} />
            <Tooltip content={<PriceTooltip />} />
            <Line type="monotone" dataKey="price" stroke="var(--chart-line)" strokeWidth={2} dot={{ r: 3, fill: 'var(--chart-line)' }} connectNulls={false} />
            {analysis && predictionDays.length > 0 && (
              <Line type="monotone" dataKey="predicted" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: '#F59E0B', stroke: '#fff', strokeWidth: 1.5 }} connectNulls={true} />
            )}
            {analysis && predictionDays.length > 0 && (
              <ReferenceLine x="어제" stroke="var(--chart-grid)" strokeDasharray="4 4" label={{ value: '오늘', position: 'top', fontSize: 10, fill: 'var(--chart-axis)' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* 거래량 차트 */}
        {historyVolumes.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981', display: 'inline-block' }} />
                거래량 (최근 7일)
              </div>
              <button onClick={() => setShowVolumeDetail(true)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
                수급 상세 ↗
              </button>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={volumeData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} />
                <YAxis tickFormatter={formatVolume} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} width={40} />
                <Tooltip content={<VolumeTooltip />} />
                <Bar dataKey="volume" fill="#10B981" opacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* 주가 상세 모달 */}
      {showPriceDetail && (
        <ModalWrapper onClose={() => setShowPriceDetail(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#111827', fontSize: 16 }}>전체 주가 상세</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>총 {allPrices.length}일 · 최신순</p>
            </div>
            <CloseBtn onClose={() => setShowPriceDetail(false)} />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                {['날짜', '종가', '전일비', '등락률', '거래량'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === '날짜' ? 'left' : 'right', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priceTableData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{row.label}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                    {isKorean ? `${row.price.toLocaleString()}원` : `$${row.price.toLocaleString()}`}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: row.change > 0 ? '#10B981' : row.change < 0 ? '#EF4444' : '#9ca3af' }}>
                    {row.change != null ? (row.change > 0 ? '+' : '') + row.change.toLocaleString() : '–'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: row.changePct > 0 ? '#10B981' : row.changePct < 0 ? '#EF4444' : '#9ca3af' }}>
                    {row.changePct != null ? (row.changePct > 0 ? '+' : '') + row.changePct.toFixed(2) + '%' : '–'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#6b7280' }}>
                    {row.volume ? row.volume.toLocaleString() : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalWrapper>
      )}

      {/* 수급 상세 모달 */}
      {showVolumeDetail && (
        <ModalWrapper onClose={() => setShowVolumeDetail(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#111827', fontSize: 16 }}>투자자별 수급 상세</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                총 {investorData.length}일 · 양수=순매수 / 음수=순매도
              </p>
            </div>
            <CloseBtn onClose={() => setShowVolumeDetail(false)} />
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            {[['기관', '#3B82F6'], ['외국인', '#8B5CF6'], ['개인', '#F59E0B']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                {label}
              </div>
            ))}
          </div>

          {investorData.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  {['날짜', '기관', '외국인', '개인'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === '날짜' ? 'left' : 'right', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investorData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12 }}>{row.date}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: row.institution > 0 ? '#3B82F6' : row.institution < 0 ? '#EF4444' : '#9ca3af' }}>
                      {formatFlow(row.institution)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: row.foreign > 0 ? '#8B5CF6' : row.foreign < 0 ? '#EF4444' : '#9ca3af' }}>
                      {formatFlow(row.foreign)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: row.individual > 0 ? '#F59E0B' : row.individual < 0 ? '#EF4444' : '#9ca3af' }}>
                      {formatFlow(row.individual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
              수급 데이터를 불러오는 중이거나 한국 주식이 아닙니다.
            </div>
          )}
        </ModalWrapper>
      )}
    </>
  );
}

export default StockChartCard;