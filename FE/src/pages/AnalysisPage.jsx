import React, { useState, useRef } from 'react';
import { MOCK_STOCKS } from '../App.jsx';
import { searchStocks } from '../api.js';
import SummaryCards from '../SummaryCards.jsx';
import StockChartCard from '../StockChartCard.jsx';
import ReliabilityCard from '../ReliabilityCard.jsx';
import SentimentCard from '../SentimentCard.jsx';
import RecentNewsCard from '../RecentNewsCard.jsx';
import AiReportCard from '../AiReportCard.jsx';
import WatchlistPanel from '../WatchlistPanel.jsx';

function AnalysisPage({
  selectedStock, analysis, isLoading, loadingMsg,
  isFavorite, onToggleFavorite, onAnalyze,
  user, favorites, history, recommendations,
  onRemoveFavorite, onDeleteHistory,
  searchTerm, setSearchTerm,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null); // 드롭다운에서 선택한 종목 기억
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setSelectedResult(null);
    setIsDropdownOpen(true);
    clearTimeout(debounceRef.current);
    const clean = val.replace(/\s*\(.*\)/, '').trim();
    if (clean.length < 1) { setSearchResults([]); return; }

    const localMatches = MOCK_STOCKS.filter(s =>
      s.name.toLowerCase().includes(clean.toLowerCase()) ||
      s.code.toLowerCase().includes(clean.toLowerCase()) ||
      (s.aliases ?? []).some(a => a.toLowerCase().includes(clean.toLowerCase()))
    ).map(s => ({ ticker: s.code, name: s.name, exchange: '', _stock: s }));
    setSearchResults(localMatches);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const remote = await searchStocks(clean);
        const localTickers = new Set(localMatches.map(r => r.ticker));
        setSearchResults([...localMatches, ...remote.filter(r => !localTickers.has(r.ticker))]);
      } catch (_) {}
      setIsSearching(false);
    }, 300);
  };

  const handleSelectResult = (result) => {
    const existing = MOCK_STOCKS.find(s => s.code === result.ticker);
    const stock = existing ?? {
      name: result.name, code: result.ticker, exchange: result.exchange ?? '',
      price: '-', change: '-', isPositive: true,
      predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
      newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
    };
    setSearchTerm(`${result.name} (${result.ticker})`);
    setSelectedResult(stock);
    setIsDropdownOpen(false);
    setSearchResults([]);
  };

  const handleAnalysisClick = () => {
    // 드롭다운에서 선택한 종목이 있으면 그걸 그대로 사용
    if (selectedResult) {
      setIsDropdownOpen(false);
      onAnalyze(selectedResult);
      return;
    }
    // 검색 결과가 있으면 첫 번째 항목 사용
    if (searchResults.length > 0) {
      const first = searchResults[0];
      const existing = MOCK_STOCKS.find(s => s.code === first.ticker);
      const stock = existing ?? {
        name: first.name, code: first.ticker, exchange: first.exchange ?? '',
        price: '-', change: '-', isPositive: true,
        predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
        newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
      };
      setSearchTerm(`${first.name} (${first.ticker})`);
      setIsDropdownOpen(false);
      onAnalyze(stock);
      return;
    }
    const raw = searchTerm.trim();
    const codeMatch = raw.match(/\(([^)]+)\)/);
    const ticker = codeMatch ? codeMatch[1] : raw;
    const cleanName = raw.replace(/\s*\(.*\)/, '').toLowerCase().trim();
    const matchedStock = MOCK_STOCKS.find(s =>
      s.name.toLowerCase().includes(cleanName) ||
      s.code.toLowerCase() === ticker.toLowerCase() ||
      (s.aliases ?? []).some(a => a.toLowerCase().includes(cleanName))
    );
    const stock = matchedStock ?? {
      name: ticker.toUpperCase(), code: ticker.toUpperCase(),
      price: '-', change: '-', isPositive: true,
      predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
      newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
    };
    setIsDropdownOpen(false);
    onAnalyze(stock);
  };

  const showPopular = searchTerm.length === 0 || searchTerm.includes(')');
  const displayList = showPopular
    ? MOCK_STOCKS.map(s => ({ ticker: s.code, name: s.name, exchange: '', _stock: s }))
    : searchResults;

  const hasWarning = !analysis
    ? (selectedStock.newsStatus === '권장치 미달' || selectedStock.sentiment?.includes?.('혼재'))
    : analysis.warnings?.length > 0;
  const warningText = analysis
    ? analysis.warnings?.join(' · ')
    : `${selectedStock.name} 신뢰도 주의 — 뉴스 데이터 부족 또는 감성 혼재 감지`;

  return (
    <div className="page-analysis">
      {/* 검색 바 */}
      <div className="analysis-search-row">
        <div className="analysis-search-wrap" ref={dropdownRef}>
          <div className="analysis-search-box">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="analysis-search-input"
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => { if (!selectedResult) { setSearchTerm(''); } setSearchResults([]); setIsDropdownOpen(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setIsDropdownOpen(false); handleAnalysisClick(); } }}
              placeholder="종목명 또는 코드 검색 (예: 오뚜기, NVDA, TSLA)"
            />
          </div>
          {isDropdownOpen && (
            <div className="search-dropdown">
              <div className="dropdown-title">
                {showPopular ? '인기 종목' : isSearching ? '검색 중...' : `검색 결과 ${displayList.length}건`}
              </div>
              <div className="dropdown-list">
                {displayList.length > 0 ? displayList.map((r, i) => (
                  <div key={i} className="dropdown-item" onClick={() => handleSelectResult(r)}>
                    <span className="stock-name">{r.name}</span>
                    <span className="stock-code">{r.ticker}{r.exchange ? ` · ${r.exchange}` : ''}</span>
                  </div>
                )) : !isSearching && (
                  <div className="dropdown-no-result">검색 결과가 없습니다.</div>
                )}
              </div>
            </div>
          )}
        </div>
        <button className="btn-analyze" onClick={handleAnalysisClick}>분석 시작 →</button>
      </div>

      {/* 관심 종목 패널 (로그인 시) */}
      {user && (
        <WatchlistPanel
          favorites={favorites}
          history={history}
          recommendations={recommendations}
          onSelectStock={onAnalyze}
          onRemoveFavorite={onRemoveFavorite}
          onDeleteHistory={onDeleteHistory}
        />
      )}

      {isLoading && loadingMsg && (
        <div className="loading-banner">{loadingMsg}</div>
      )}

      {/* 종목 헤더 */}
      <div className="stock-hero-card">
        <div>
          <p className="stock-hero-ticker">{selectedStock.code}</p>
          <h2 className="stock-hero-name">{selectedStock.name}</h2>
        </div>
        <div className="stock-hero-right">
          <p className="stock-hero-price">{analysis
            ? (isNaN(analysis.price) ? analysis.price : Number(analysis.price).toLocaleString())
            : selectedStock.price}
          </p>
          <p className={`stock-hero-change ${selectedStock.isPositive ? 'positive' : 'negative'}`}>
            {selectedStock.change}
          </p>
        </div>
      </div>

      {hasWarning && (
        <div className="alert-banner">⚠ {warningText}</div>
      )}

      <SummaryCards
        stock={selectedStock}
        analysis={analysis}
        isLoading={isLoading}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
      />

      <div className="main-content-grid">
        <StockChartCard stock={selectedStock} analysis={analysis} />
        <ReliabilityCard stock={selectedStock} analysis={analysis} isLoading={isLoading} />
      </div>

      <div className="sub-content-grid">
        <SentimentCard stock={selectedStock} analysis={analysis} isLoading={isLoading} />
        <RecentNewsCard stock={selectedStock} analysis={analysis} />
      </div>

      <AiReportCard stock={selectedStock} analysis={analysis} isLoading={isLoading} />
    </div>
  );
}

export default AnalysisPage;
