import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const DAYS = ['7일전', '6일전', '5일전', '4일전', '3일전', '2일전', '어제', '오늘'];

function StockChartCard({ stock, analysis }) {
  const chartData = stock.chartData.map((price, i) => ({
    day: DAYS[i],
    price,
  }));

  if (analysis) {
    const { prediction } = analysis;
    chartData.push({
      day: '7일후(예측)',
      price: null,
      predicted: prediction.future_price,
    });
  }

  const allValues = chartData.flatMap(d => [d.price, d.predicted].filter(Boolean));
  const minVal = Math.floor(Math.min(...allValues) * 0.995);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.005);

  const isKorean = stock.code.includes('.KS');
  const formatPrice = (v) => isKorean ? `${(v / 1000).toFixed(0)}k` : `$${v}`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const displayVal = isKorean ? `${val?.toLocaleString()}원` : `$${val}`;
      return (
        <div style={{ background: '#fff', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
          <p style={{ margin: 0, color: '#8A8A82' }}>{label}</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{displayVal}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card chart-section">
      <h3>주가 흐름 & 예측 (7일)</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EC" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#8A8A82' }} />
          <YAxis domain={[minVal, maxVal]} tickFormatter={formatPrice} tick={{ fontSize: 11, fill: '#8A8A82' }} width={45} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2D2D2A"
            strokeWidth={2}
            dot={{ r: 3, fill: '#2D2D2A' }}
            connectNulls={false}
            name="실제가"
          />
          {analysis && (
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4, fill: '#F59E0B' }}
              name="예측가"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StockChartCard;
