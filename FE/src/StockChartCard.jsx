import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { isKoreanStock } from './currencyUtils.js';

const DAYS = ['7일전', '6일전', '5일전', '4일전', '3일전', '2일전', '어제'];

function StockChartCard({ stock, analysis }) {
  const isKorean = isKoreanStock(stock, analysis);

  const historyPrices = (analysis?.price_history?.length)
    ? analysis.price_history
    : stock.chartData;

  const chartData = historyPrices.map((price, i) => ({
    day: DAYS[i] ?? `${historyPrices.length - i}일전`,
    price,
    predicted: null,
  }));

  if (analysis) {
    const lastPrice = historyPrices[historyPrices.length - 1];
    chartData[chartData.length - 1].predicted = lastPrice;
    chartData.push({
      day: '7일후(예측)',
      price: null,
      predicted: analysis.prediction.future_price,
    });
  }

  const allValues = chartData.flatMap(d => [d.price, d.predicted].filter(v => v != null));
  const minVal = Math.floor(Math.min(...allValues) * 0.995);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.005);

  const formatPrice = (v) => isKorean ? `${(v / 1000).toFixed(0)}k` : `$${v}`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const val = payload.find(p => p.value != null)?.value;
    if (val == null) return null;
    const displayVal = isKorean ? `${val.toLocaleString()}원` : `$${val.toLocaleString()}`;
    const isPredict = label === '7일후(예측)';
    return (
      <div style={{
        background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)',
        borderRadius: 8, padding: '8px 12px', fontSize: 13
      }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 600, color: isPredict ? '#F59E0B' : 'var(--text-primary)' }}>{displayVal}</p>
        {isPredict && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Prophet 7일 예측</p>}
      </div>
    );
  };

  return (
    <div className="card chart-section">
      <h3>
        주가 흐름 & 예측 (7일)
        {!analysis && (
          <span className="text-muted font-normal" style={{ fontSize: 12, marginLeft: 8 }}>
            목데이터 — 분석 시작 시 실제 주가로 업데이트
          </span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} />
          <YAxis
            domain={[minVal, maxVal]}
            tickFormatter={formatPrice}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--chart-line)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-line)' }}
            connectNulls={false}
            name="실제가"
          />

          {analysis && (
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={(props) => {
                const { cx, cy, index } = props;
                if (index === chartData.length - 1) {
                  return <circle key={index} cx={cx} cy={cy} r={5} fill="#F59E0B" stroke="#fff" strokeWidth={2} />;
                }
                return <circle key={index} cx={cx} cy={cy} r={0} />;
              }}
              connectNulls={true}
              name="예측가"
            />
          )}

          {analysis && (
            <ReferenceLine
              x="어제"
              stroke="var(--chart-grid)"
              strokeDasharray="4 4"
              label={{ value: '오늘', position: 'top', fontSize: 10, fill: 'var(--chart-axis)' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StockChartCard;
