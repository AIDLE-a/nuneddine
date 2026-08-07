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
    a.download = `누네띄네_전체예측기록_${new Date().toISOString().slice(0,10)}.json`;
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

      <div className="fav-tab-row">
        {[
          { key: 'analysis', label: '분석 기록' },
          { key: 'prediction', label: '예측 기록' },
        ].map(tab => (
          <button key={tab.key} className={`fav-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setSelectedTicker(null); }}>
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
            <button className="ranking-analyze-btn" onClick={() => navigate('/')}>종목 분석하러 가기</button>
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
                  <button className="ranking-analyze-btn" onClick={() => handleAnalyze(h.ticker, h.name)}>다시 분석 →</button>
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
              <div className="empty-state-icon"></div>
              <p className="empty-state-text">예측 기록이 없습니다</p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 16px' }}>종목 분석 후 자동으로 저장돼요</p>
              <button className="ranking-analyze-btn" onClick={() => navigate('/')}>종목 분석하러 가기</button>
            </div>
          ) : !selectedTicker ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                  총 {predictions.length}개 종목의 예측 기록이 있어요
                </p>
                <button onClick={handleExportAll} className="btn-secondary" style={{ fontSize: 12 }}>
                  전체 JSON 내보내기
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {predictions.map(p => (
                  <div key={p.ticker}
                    onClick={() => handleSelectTicker(p.ticker)}
                    className="history-item"
                    style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                      </div>
                      <div>
                        <p className="history-name">{p.name}</p>
                        <p className="history-ticker">{p.ticker} · {p.recordCount}개 기록 · 최근 {p.lastDate}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={e => { e.stopPropagation(); handleExport(p.ticker, p.name); }} className="btn-secondary" style={{ fontSize: 11 }}>
                        JSON ↓
                      </button>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => setSelectedTicker(null)} className="btn-secondary" style={{ marginBottom: 16, fontSize: 12 }}>
                ← 목록으로
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {predictions.find(p => p.ticker === selectedTicker)?.name}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    {selectedTicker} · {tickerRecords.length}개 기록
                  </p>
                </div>
                <button onClick={() => handleExport(selectedTicker, predictions.find(p => p.ticker === selectedTicker)?.name)} className="btn-secondary" style={{ fontSize: 12 }}>
                  JSON 내보내기
                </button>
              </div>

              <div className="fav-tab-row">
                {horizonOptions.map(h => (
                  <button key={h} className={`fav-tab${selectedHorizon === h ? ' active' : ''}`} onClick={() => setSelectedHorizon(h)}>
                    {h.replace('d', '')}일 후
                  </button>
                ))}
              </div>

              {tickerRecords.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>기록이 없어요</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tickerRecords.map((record, i) => {
                    const pred = record.predictions?.[selectedHorizon];
                    if (!pred) return null;

                    const verifierRecord = {
                      date: pred.targetDate,
                      lower: pred.lower,
                      upper: pred.upper,
                      predictedPrice: pred.predictedPrice,
                      currentPrice: record.currentPrice,
                    };

                    const alphaColor = record.compositeAlpha > 0.2 ? 'var(--positive)' : record.compositeAlpha < -0.2 ? 'var(--negative)' : '#F59E0B';

                    return (
                      <div key={i} className="modal-section" style={{ borderRadius: 12, padding: '14px 16px' }}>

                        {/* 헤더 + 신뢰도 인라인 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{record.date} 분석</span>
                            {i === 0 && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 700 }}>최신</span>}
                          </div>
                          <PredictionVerifier ticker={selectedTicker} record={verifierRecord} />
                        </div>

                        {/* 신뢰도 바 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 700 }}>신뢰도 <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pred.confidence}%</strong></span>
                          <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 5 }}>
                            <div style={{ width: `${pred.confidence}%`, background: 'var(--gradient)', height: 5, borderRadius: 4 }} />
                          </div>
                        </div>

                        {/* 메트릭 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                            AI 예측 구간 · {pred.targetDate}&nbsp;&nbsp;
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(pred.lower, selectedTicker)} ~ {fmt(pred.upper, selectedTicker)}</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>(예측 중심값 {fmt(pred.predictedPrice, selectedTicker)})</span>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                            분석 시점 현재가&nbsp;&nbsp;<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(record.currentPrice, selectedTicker)}</span>
                          </span>
                          {record.compositeAlpha != null && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                              종합 알파 <span style={{ fontWeight: 700, color: '#F59E0B' }}>{record.compositeAlpha > 0 ? '+' : ''}{record.compositeAlpha?.toFixed(3)}</span>
                              {record.sentiment?.positive != null && <><span style={{ margin: '0 6px' }}>|</span><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>감성 {Math.round(record.sentiment.positive * 100)}%</span></>}
                            </span>
                          )}
                        </div>
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