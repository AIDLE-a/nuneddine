import React, { useState, useRef, useEffect } from 'react';
import { MOCK_STOCKS } from '../App.jsx';
import { searchStocks, fetchPrices } from '../api.js';
import { isKoreanStock, formatPrice } from '../currencyUtils.js';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import SummaryCards from '../SummaryCards.jsx';
import StockChartCard from '../StockChartCard.jsx';
import ReliabilityCard from '../ReliabilityCard.jsx';
import SentimentCard from '../SentimentCard.jsx';
import RecentNewsCard from '../RecentNewsCard.jsx';
import AiReportCard from '../AiReportCard.jsx';
import WatchlistPanel from '../WatchlistPanel.jsx';
import NotificationBell from '../components/NotificationBell.jsx';

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
  const [selectedResult, setSelectedResult] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const [popularList, setPopularList] = useState([]);
  const [popularPrices, setPopularPrices] = useState({});
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // 인기 종목: 최근 1시간 분석 로그에서 실시간 집계
  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const q = query(collection(db, 'stockAnalysisLog'), where('analyzedAt', '>=', since));
    const unsub = onSnapshot(q, snap => {
      const countMap = {};
      snap.docs.forEach(d => {
        const { ticker, name } = d.data();
        if (!ticker) return;
        if (!countMap[ticker]) countMap[ticker] = { ticker, name, count: 0 };
        countMap[ticker].count += 1;
      });
      const sorted = Object.values(countMap).sort((a, b) => b.count - a.count).slice(0, 8);
      const list = sorted.length > 0
        ? sorted.map(s => ({ ticker: s.ticker, name: s.name, exchange: '' }))
        : MOCK_STOCKS.map(s => ({ ticker: s.code, name: s.name, exchange: '' }));
      setPopularList(list);
      fetchPrices(list.map(s => s.ticker)).then(p => setPopularPrices(p)).catch(() => {});
    });
    return () => unsub();
  }, []);

  // selectedStock이 바뀌거나 포커스 해제 시 검색창 동기화
  useEffect(() => {
    if (!isFocused && selectedStock) {
      setSearchTerm(`${selectedStock.name} (${selectedStock.code})`);
    }
  }, [selectedStock, isFocused]);

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
    onAnalyze(stock); // 드롭다운 선택 즉시 분석 시작
  };

  const handleAnalysisClick = async () => {
    setIsDropdownOpen(false);

    // 드롭다운에서 선택한 종목이 있으면 그걸 그대로 사용
    if (selectedResult) {
      onAnalyze(selectedResult);
      return;
    }

    const raw = searchTerm.trim();
    if (!raw) return;

    const codeMatch = raw.match(/\(([^)]+)\)/);
    const ticker = codeMatch ? codeMatch[1] : raw;
    const cleanName = raw.replace(/\s*\(.*\)/, '').toLowerCase().trim();

    // MOCK_STOCKS에서 먼저 찾기
    const matchedStock = MOCK_STOCKS.find(s =>
      s.name.toLowerCase().includes(cleanName) ||
      s.code.toLowerCase() === ticker.toLowerCase() ||
      (s.aliases ?? []).some(a => a.toLowerCase().includes(cleanName))
    );
    if (matchedStock) { onAnalyze(matchedStock); return; }

    // 검색 결과가 있으면 첫 번째 항목 사용
    if (searchResults.length > 0) {
      const first = searchResults[0];
      const stock = { name: first.name, code: first.ticker, exchange: first.exchange ?? '',
        price: '-', change: '-', isPositive: true, predict7d: '-', range: '-',
        sentiment: '-', sentimentSub: '-', newsCount: '-', newsStatus: '적정',
        chartData: [], news: [], aiReport: '', aiWarning: '' };
      setSearchTerm(`${first.name} (${first.ticker})`);
      setSelectedResult(stock);
      onAnalyze(stock);
      return;
    }

    // 검색 결과도 없으면 API로 직접 검색
    try {
      const { searchStocks } = await import('../api.js');
      const results = await searchStocks(cleanName || ticker);
      if (results.length > 0) {
        const first = results[0];
        const stock = { name: first.name, code: first.ticker, exchange: first.exchange ?? '',
          price: '-', change: '-', isPositive: true, predict7d: '-', range: '-',
          sentiment: '-', sentimentSub: '-', newsCount: '-', newsStatus: '적정',
          chartData: [], news: [], aiReport: '', aiWarning: '' };
        setSearchTerm(`${first.name} (${first.ticker})`);
        setSelectedResult(stock);
        onAnalyze(stock);
        return;
      }
    } catch (_) {}

    // 최후 폴백: 입력값 그대로 사용
    onAnalyze({ name: ticker.toUpperCase(), code: ticker.toUpperCase(),
      price: '-', change: '-', isPositive: true, predict7d: '-', range: '-',
      sentiment: '-', sentimentSub: '-', newsCount: '-', newsStatus: '적정',
      chartData: [], news: [], aiReport: '', aiWarning: '' });
  };

  const showPopular = searchTerm.length === 0 || searchTerm.includes(')');
  const displayList = showPopular ? popularList : searchResults;

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
              onFocus={() => { setIsFocused(true); setSearchTerm(''); setSelectedResult(null); setSearchResults([]); setIsDropdownOpen(true); }}
              onBlur={() => { setTimeout(() => { setIsFocused(false); setIsDropdownOpen(false); }, 150); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setIsDropdownOpen(false); handleAnalysisClick(); } }}
              placeholder="종목명 또는 코드 검색"
            />
          </div>
          {isDropdownOpen && (
            <div className="search-dropdown">
              <div className="dropdown-title">
                {showPopular ? '인기 종목' : isSearching ? '검색 중...' : `검색 결과 ${displayList.length}건`}
              </div>
              <div className="dropdown-list">
                {displayList.length > 0 ? displayList.map((r, i) => {
                  const price = showPopular ? popularPrices[r.ticker] : null;
                  const korean = r.ticker?.includes('.KS') || r.ticker?.includes('.KQ');
                  const priceStr = price != null ? formatPrice(price, korean) : null;
                  return (
                    <div key={i} className="dropdown-item" onClick={() => handleSelectResult(r)}>
                      <span className="stock-name">{r.name}</span>
                      <span className="stock-code">{r.ticker}{r.exchange ? ` · ${r.exchange}` : ''}</span>
                      {priceStr && <span className="dropdown-price">{priceStr}</span>}
                    </div>
                  );
                }) : !isSearching && (
                  <div className="dropdown-no-result">검색 결과가 없습니다.</div>
                )}
              </div>
            </div>
          )}
        </div>
        <button className="btn-analyze" onClick={handleAnalysisClick}>분석 시작 →</button>
        <NotificationBell user={user} />
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
