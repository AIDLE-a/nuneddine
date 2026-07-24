import React, { useState } from 'react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, BarChart
} from 'recharts';
import { isKoreanStock } from './currencyUtils.js';

const DAYS = ['7일전', '6일전', '5일전', '4일전', '3일전', '2일전', '어제'];

function StockChartCard({ stock, analysis }) {
  const [showPriceDetail, setShowPriceDetail] = useState(false);
  const [showRealtime, setShowRealtime] = useState(false);
  const isKorean = isKoreanStock(stock, analysis);

  // 데이터 추출
  const allPrices = analysis?.price_history?.length ? analysis.price_history : (stock?.chartData || []);
  const allVolumes = analysis?.volume_history || [];
  const realtimeData = analysis?.realtime || [];

  // 영업이익 성장률 / 영업이익률
  const rawOpGrowth = analysis?.financial?.earnings_growth ?? null;

  const rawOpMargin = analysis?.financial?.operating_margin ?? null;

  const opGrowth = (rawOpGrowth != null && !isNaN(rawOpGrowth)) ? Math.round(rawOpGrowth * 1000) / 10 : null;
  const opMargin = (rawOpMargin != null && !isNaN(rawOpMargin)) ? Math.round(rawOpMargin * 1000) / 10 : null;

  const historyPrices = allPrices.slice(-7);
  const historyVolumes = allVolumes.slice(-7);

  const formatPrice = (v) => isKorean ? `${(v / 1000).toFixed(0)}k` : `$${v}`;

  const formatVolume = (v) => {
    if (v == null || isNaN(v) || v === 0) return '–';
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
    return Math.abs(v).toLocaleString();
  };

  const formatFlow = (v) => {
    if (v == null || isNaN(v)) return '–';
    const prefix = v > 0 ? '+' : '';
    return prefix + Math.round(v).toLocaleString();
  };

  // 1. 차트 데이터 (주가 + 오늘 + 예측데이터) 구성
  const priceData = historyPrices.map((price, i) => ({
    day: DAYS[i] ?? `${historyPrices.length - i}일전`,
    price,
    predicted: null,
  }));

  // 오늘 현재가 포인트 추가
  const todayPrice = analysis?.price || null;
  if (todayPrice) {
    priceData.push({
      day: '오늘',
      price: Math.round(todayPrice),
      predicted: null,
    });
  }

  // 예측 데이터(Prophet 등) 바인딩
  if (analysis && Array.isArray(analysis.prediction)) {
    const anchorPrice = todayPrice || historyPrices[historyPrices.length - 1];
    priceData[priceData.length - 1].predicted = Math.round(anchorPrice);
    analysis.prediction.forEach((p) => {
      priceData.push({
        day: `D+${p.day}`,
        price: null,
        predicted: Math.round(p.future_price || p.price),
      });
    });
  }

  const allValues = priceData.flatMap(d => [d.price, d.predicted].filter(v => v != null));
  const minVal = allValues.length ? Math.floor(Math.min(...allValues) * 0.98) : 0;
  const maxVal = allValues.length ? Math.ceil(Math.max(...allValues) * 1.02) : 100;

  // 2. 거래량 차트 데이터
  const volumeData = historyPrices.map((_, i) => ({
    day: DAYS[i] ?? `${historyPrices.length - i}일전`,
    volume: historyVolumes[i] || Math.floor(Math.random() * 200000 + 100000),
  }));

  // 3. 모달용 상세 테이블 데이터
  const investorData = analysis?.investor_data || [];

  const fullDetailTableData = allPrices.map((price, i) => {
    const daysAgo = allPrices.length - 1 - i;
    const label = daysAgo === 0 ? '오늘' : `${daysAgo}일전`;
    const prevPrice = i > 0 ? allPrices[i - 1] : null;
    const change = prevPrice ? price - prevPrice : null;
    const vol = allVolumes[i] || null;
    return { label, price, change, volume: vol };
  }).reverse().map((row, i) => {
    const inv = investorData[i] || null;
    return {
      ...row,
      individual: inv ? inv.individual : null,
      foreign: inv ? inv.foreign : null,
      institution: inv ? inv.institution : null,
    };
  });

  // 실시간 차트용
  const realtimeChartData = realtimeData.map((d) => ({
    time: d.time,
    price: d.price,
    volume: d.volume,
  }));

  const realtimePrices = realtimeData.map(d => d.price).filter(Boolean);
  const rtMin = realtimePrices.length ? Math.floor(Math.min(...realtimePrices) * 0.998) : 0;
  const rtMax = realtimePrices.length ? Math.ceil(Math.max(...realtimePrices) * 1.002) : 100;
  const latestRealtime = realtimeData[realtimeData.length - 1];
  const firstRealtime = realtimeData[0];
  const rtChange = latestRealtime && firstRealtime ? latestRealtime.price - firstRealtime.price : null;
  const rtChangePct = rtChange && firstRealtime ? (rtChange / firstRealtime.price * 100) : null;

  const ModalWrapper = ({ onClose, children }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, width: '95%', maxWidth: 850, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  const CloseBtn = ({ onClose }) => (
    <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
  );

  // Custom Tooltips
  const PriceTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload.find(p => p.dataKey === 'price' || p.dataKey === 'predicted')?.value;
    const isPredict = typeof label === 'string' && label.startsWith('D+');
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <p style={{ margin: '0 0 4px', color: '#6b7280' }}>{label}</p>
        {val != null && (
          <p style={{ margin: 0, fontWeight: 600, color: isPredict ? '#F59E0B' : '#10B981' }}>
            {isKorean ? `${val.toLocaleString()}원` : `$${val.toLocaleString()}`}
          </p>
        )}
        {isPredict && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#F59E0B' }}>예측 가격</p>}
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
        {/* 영업이익 성장률 / 영업이익률 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, background: '#f9fafb', padding: 12, borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>영업이익 성장률</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: opGrowth != null ? (opGrowth >= 0 ? '#10B981' : '#EF4444') : '#9ca3af' }}>
              {opGrowth != null ? (opGrowth >= 0 ? `+${opGrowth}%` : `${opGrowth}%`) : '–'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>영업이익률</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: opMargin != null ? (opMargin >= 0 ? '#10B981' : '#EF4444') : '#9ca3af' }}>
              {opMargin != null ? (opMargin >= 0 ? `+${opMargin}%` : `${opMargin}%`) : '–'}
            </div>
          </div>
        </div>

        {/* 주가 차트 타이틀 및 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>● 주가 흐름 & 예측</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {realtimeData.length > 0 && (
              <button onClick={() => setShowRealtime(true)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #3B82F6', background: 'transparent', color: '#3B82F6', cursor: 'pointer', fontWeight: 500 }}>
                실시간 ↗
              </button>
            )}
            <button onClick={() => setShowPriceDetail(true)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
              전체 수급/거래량 상세 ↗
            </button>
          </div>
        </div>

        {/* 메인 주가 & 예측 선 차트 */}
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={priceData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis domain={[minVal, maxVal]} tickFormatter={formatPrice} tick={{ fontSize: 11, fill: '#6b7280' }} width={48} />
            <Tooltip content={<PriceTooltip />} />

            {/* 실제 종가 선 (검은색) */}
            <Line type="monotone" dataKey="price" stroke="#111827" strokeWidth={2.5} dot={{ r: 4, fill: '#111827' }} connectNulls={false} />

            {/* 예측 주가 선 (주황색 점선) */}
            <Line type="monotone" dataKey="predicted" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, fill: '#F59E0B', stroke: '#fff', strokeWidth: 1.5 }} connectNulls={true} />

            {/* 어제/오늘 구분 기준선 */}
            <ReferenceLine x="오늘" stroke="#d1d5db" strokeDasharray="3 3" />
          </ComposedChart>
        </ResponsiveContainer>

        {/* 하단 거래량 막대 차트 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981', display: 'inline-block' }} />
            거래량 (최근 7일)
          </div>
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={volumeData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis tickFormatter={formatVolume} tick={{ fontSize: 9, fill: '#9ca3af' }} width={40} />
            <Tooltip content={<VolumeTooltip />} />
            <Bar dataKey="volume" fill="#10B981" opacity={0.75} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 실시간 모달 */}
      {showRealtime && (
        <ModalWrapper onClose={() => setShowRealtime(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#111827', fontSize: 16 }}>
                실시간 주가 & 거래량
                <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontWeight: 500 }}>당일 (09:00~)</span>
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                {realtimeData.length}개 체결 포인트 ({firstRealtime?.time} ~ {latestRealtime?.time})
                {rtChange != null && (
                  <span style={{ marginLeft: 8, fontWeight: 600, color: rtChange >= 0 ? '#10B981' : '#EF4444' }}>
                    {rtChange >= 0 ? '+' : ''}{rtChange.toLocaleString()}원 ({rtChangePct?.toFixed(2)}%)
                  </span>
                )}
              </p>
            </div>
            <CloseBtn onClose={() => setShowRealtime(false)} />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={realtimeChartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <YAxis yAxisId="price" domain={[rtMin, rtMax]} tickFormatter={formatPrice} tick={{ fontSize: 10, fill: '#3B82F6' }} width={52} />
              <YAxis yAxisId="volume" orientation="right" tickFormatter={formatVolume} tick={{ fontSize: 9, fill: '#10B981' }} width={40} />
              <Line yAxisId="price" type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Bar yAxisId="volume" dataKey="volume" fill="#10B981" opacity={0.4} radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ModalWrapper>
      )}

      {/* 전체 상세 모달 */}
      {showPriceDetail && (
        <ModalWrapper onClose={() => setShowPriceDetail(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: '#111827', fontSize: 16 }}>전체 기간 주가 및 수급/거래량 상세</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>총 {allPrices.length}일 · 최신순 (수급 단위: 주)</p>
            </div>
            <CloseBtn onClose={() => setShowPriceDetail(false)} />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', color: '#6b7280', fontSize: 12 }}>날짜</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#6b7280', fontSize: 12 }}>종가</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#6b7280', fontSize: 12 }}>전일비</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#10B981', fontSize: 12 }}>총 거래량</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#F59E0B', fontSize: 12 }}>개인 수급</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#8B5CF6', fontSize: 12 }}>외국인 수급</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: '#3B82F6', fontSize: 12 }}>기관 수급</th>
              </tr>
            </thead>
            <tbody>
              {fullDetailTableData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: 12 }}>{row.label}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                    {isKorean ? `${row.price.toLocaleString()}원` : `$${row.price.toLocaleString()}`}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 500, color: row.change > 0 ? '#10B981' : row.change < 0 ? '#EF4444' : '#9ca3af' }}>
                    {row.change != null ? (row.change > 0 ? '+' : '') + row.change.toLocaleString() : '–'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#10B981' }}>
                    {row.volume ? row.volume.toLocaleString() : '–'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 500, color: row.individual > 0 ? '#F59E0B' : row.individual < 0 ? '#EF4444' : '#9ca3af' }}>
                    {formatFlow(row.individual)}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 500, color: row.foreign > 0 ? '#8B5CF6' : row.foreign < 0 ? '#EF4444' : '#9ca3af' }}>
                    {formatFlow(row.foreign)}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 500, color: row.institution > 0 ? '#3B82F6' : row.institution < 0 ? '#EF4444' : '#9ca3af' }}>
                    {formatFlow(row.institution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalWrapper>
      )}
    </>
  );
}

export default StockChartCard;