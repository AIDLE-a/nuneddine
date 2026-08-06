import React, { useState, useEffect } from 'react';
import { loadPredictions, loadAllPredictions } from '../predictionStorage';
import PredictionVerifier from '../PredictionVerifier';
import { useNavigate } from 'react-router-dom';
import { MOCK_STOCKS } from '../App.jsx';

function makeStockObj(ticker, name) {
  return MOCK_STOCKS.find(s => s.code === ticker) ?? {
    name, code: ticker, price: '-', change: '-', isPositive: true,
    predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
    newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
  };
}

function HistoryPage({ history, onDeleteHistory, onAnalyze }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('analysis');
  const [predictions, setPredictions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [tickerRecords, setTickerRecords] = useState([]);
  const [selectedHorizon, setSelectedHorizon] = useState('d1');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'prediction') {
      setLoading(true);
      loadAllPredictions().then(setPredictions).finally(() => setLoading(false));
    }
  }, [activeTab]);

  const handleSelectTicker = async (ticker) => {
    setSelectedTicker(ticker);
    setSelectedHorizon('d1');
    setLoading(true);
    const records = await loadPredictions(ticker);
    setTickerRecords(records);
    setLoading(false);
  };

  const handleAnalyze = (ticker, name) => {
    onAnalyze(makeStockObj(ticker, name));
    navigate('/');
  };

  const isKRW = (ticker) => ticker?.includes('.KS') || ticker?.includes('.KQ');
  const fmt = (v, ticker) => v != null ? (isKRW(ticker) ? `${Math.round(v).toLocaleString()}원` : `$${v}`) : '-';

  const horizonOptions = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];

  const handleExportAll = async () => {
    const all = await loadAllPredictions();
    if (all.length === 0) return;
    const data = {
      exported_at: new Date().toISOString(),
      total_tickers: all.length,
      stocks: all.map(p => ({ ticker: p.ticker, name: p.name, record_count: p.recordCount })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `누네띠네_전체예측기록_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (ticker, name) => {
    const records = await loadPredictions(ticker);
    const data = { ticker, name, exported_at: new Date().toISOString(), records };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prediction_${ticker}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">기록실</h1>
        <p className="page-subtitle">분석 기록과 AI 예측 기록을 확인하세요</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'analysis', label: '📊 분석 기록' },
          { key: 'prediction', label: '🔮 예측 기록' },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedTicker(null); }}
            style={{
              padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: activeTab === tab.key ? 'none' : '1px solid #e5e7eb',
              background: activeTab === tab.key ? '#111827' : '#fff',
              color: activeTab === tab.key ? '#fff' : '#374151',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'analysis' && (
        history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <p className="empty-state-text">분석 기록이 없습니다</p>
            <button className="btn-primary" onClick={() => navigate('/')}>종목 분석하러 가기</button>
          </div>
        ) : (
          <div className="history-list">
            {history.map((h, i) => (
              <div key={h.ticker ?? i} className="history-item">
                <div className="history-item-info">
                  <span className="history-rank">{i + 1}</span>
                  <div>
                    <p className="history-name">{h.name}</p>
                    <p className="history-ticker">{h.ticker}</p>
                  </div>
                </div>
                <div className="history-item-actions">
                  <button className="btn-analyze-sm" onClick={() => handleAnalyze(h.ticker, h.name)}>다시 분석</button>
                  <button className="btn-icon btn-danger" onClick={() => onDeleteHistory(h.ticker)} title="기록 삭제">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'prediction' && (
        <div>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>불러오는 중...</p>
          ) : predictions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔮</div>
              <p className="empty-state-text">예측 기록이 없습니다</p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 16px' }}>종목 분석 후 자동으로 저장돼요</p>
              <button className="btn-primary" onClick={() => navigate('/')}>종목 분석하러 가기</button>
            </div>
          ) : !selectedTicker ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                  총 {predictions.length}개 종목의 예측 기록이 있어요
                </p>
                <button onClick={handleExportAll}
                  style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  📥 전체 JSON 내보내기
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {predictions.map(p => (
                  <div key={p.ticker}
                    onClick={() => handleSelectTicker(p.ticker)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔮</div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{p.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{p.ticker} · {p.recordCount}개 기록 · 최근 {p.lastDate}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); handleExport(p.ticker, p.name); }}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#6b7280' }}>
                        JSON ↓
                      </button>
                      <span style={{ color: '#9ca3af', fontSize: 18 }}>›</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => setSelectedTicker(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
                ← 목록으로
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                    {predictions.find(p => p.ticker === selectedTicker)?.name}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                    {selectedTicker} · {tickerRecords.length}개 기록
                  </p>
                </div>
                <button onClick={() => handleExport(selectedTicker, predictions.find(p => p.ticker === selectedTicker)?.name)}
                  style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', color: '#374151', fontWeight: 500 }}>
                  📥 JSON 내보내기
                </button>
              </div>

              {/* horizon 선택 탭 (d1~d7) */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {horizonOptions.map(h => (
                  <button key={h} onClick={() => setSelectedHorizon(h)}
                    style={{
                      padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: selectedHorizon === h ? 'none' : '1px solid #e5e7eb',
                      background: selectedHorizon === h ? '#3B82F6' : '#fff',
                      color: selectedHorizon === h ? '#fff' : '#6b7280',
                    }}>
                    {h.replace('d', '')}일 후
                  </button>
                ))}
              </div>

              {tickerRecords.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>기록이 없어요</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tickerRecords.map((record, i) => {
                    const pred = record.predictions?.[selectedHorizon];
                    if (!pred) return null;

                    // PredictionVerifier가 기대하는 flat 구조로 변환
                    const verifierRecord = {
                      date: pred.targetDate,
                      lower: pred.lower,
                      upper: pred.upper,
                      predictedPrice: pred.predictedPrice,
                      currentPrice: record.currentPrice,
                    };

                    return (
                      <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 18, background: i === 0 ? '#f0fdf4' : '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>📅 {record.date} 분석</span>
                            {i === 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>최신</span>}
                          </div>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>신뢰도 {pred.confidence}%</span>
                        </div>

                        <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 16px', marginBottom: 12, border: '1px solid #bfdbfe' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>
                            🤖 AI 예측 구간 ({selectedHorizon.replace('d', '')}일 후 · {pred.targetDate})
                          </p>
                          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>
                            {fmt(pred.lower, selectedTicker)} ~ {fmt(pred.upper, selectedTicker)}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                            예측 중심값: {fmt(pred.predictedPrice, selectedTicker)}
                          </p>
                        </div>

                        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', border: '1px solid #e5e7eb', marginBottom: 10 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6b7280' }}>분석 시점 현재가</p>
                          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#374151' }}>
                            {fmt(record.currentPrice, selectedTicker)}
                          </p>
                        </div>

                        {/* 팀원 검증 컴포넌트 — horizon별 pred를 flat 구조로 변환해서 전달 */}
                        <PredictionVerifier ticker={selectedTicker} record={verifierRecord} />

                        {record.compositeAlpha != null && (
                          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', gap: 16 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>종합 알파:
                              <span style={{ fontWeight: 700, color: record.compositeAlpha > 0.2 ? '#10B981' : record.compositeAlpha < -0.2 ? '#EF4444' : '#F59E0B', marginLeft: 4 }}>
                                {record.compositeAlpha > 0 ? '+' : ''}{record.compositeAlpha?.toFixed(3)}
                              </span>
                            </span>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>감성: {record.sentiment?.positive != null ? `${Math.round(record.sentiment.positive * 100)}%` : '-'}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;