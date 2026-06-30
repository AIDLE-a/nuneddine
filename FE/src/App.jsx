import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

import Sidebar from './Sidebar.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import MyPage from './pages/MyPage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';
import PostDetailPage from './pages/PostDetailPage.jsx';

import { analyzeStock, getRelatedStocks } from './api.js';
import { auth, saveHistory, getHistory, deleteHistory, addFavorite, removeFavorite, getFavorites } from './firebase.js';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { provider } from './firebase.js';

export const MOCK_STOCKS = [
  {
    name: "삼성전자", code: "005930.KS", aliases: ["samsung", "삼전"],
    price: "72,400원", change: "+1,200 (+1.7%)", isPositive: true,
    predict7d: "73,500원", range: "68k ~ 76k 구간",
    sentiment: "긍정 우세", sentimentSub: "긍정 62% / 부정 31%",
    newsCount: "8건", newsStatus: "권장치 미달",
    chartData: [71200, 71500, 71000, 71800, 72000, 72100, 72400],
    news: [
      { title: "삼성전자, HBM4 양산 일정 앞당겨", source: "한국경제", url: "https://www.google.com/search?q=삼성전자+HBM4", published_at: "2시간 전", sentiment: "positive" },
      { title: "메모리 반도체 수요 둔화 우려 재부각", source: "매일경제", url: "https://www.google.com/search?q=메모리+반도체+수요+둔화", published_at: "5시간 전", sentiment: "negative" },
      { title: "외국인 순매수 3거래일 연속 이어져", source: "연합뉴스", url: "https://www.google.com/search?q=삼성전자+외국인+순매수", published_at: "어제", sentiment: "positive" },
    ],
    aiReport: "삼성전자는 HBM4 양산 일정 조기 착수를 발표하며 AI 메모리 시장에서의 기술 주도권 강화 의지를 확인했습니다. 외국인 순매수 흐름이 3거래일 지속되고 있어 단기 수급은 긍정적으로 판단됩니다.",
    aiWarning: "단, 메모리 수요 둔화에 관한 뉴스가 부정적 신호를 동시에 발생시키고 있으며 이 구간의 예측 신뢰도는 제한적입니다.",
  },
  {
    name: "SK하이닉스", code: "000660.KS", aliases: ["하이닉스", "sk", "hynix"],
    price: "168,500원", change: "+4,500 (+2.74%)", isPositive: true,
    predict7d: "172,000원", range: "160k ~ 180k 구간",
    sentiment: "긍정 압도", sentimentSub: "긍정 78% / 부정 12%",
    newsCount: "24건", newsStatus: "충분",
    chartData: [161000, 163000, 162500, 165000, 166000, 164000, 168500],
    news: [
      { title: "SK하이닉스, AI 메모리 수요 급증 수혜", source: "한국경제", url: "https://www.google.com/search?q=SK하이닉스+AI+메모리", published_at: "1시간 전", sentiment: "positive" },
      { title: "HBM3E 엔비디아 독점 공급 계획", source: "서울경제", url: "https://www.google.com/search?q=SK하이닉스+HBM3E", published_at: "3시간 전", sentiment: "positive" },
      { title: "외국인 기관 동반 순매수 지속", source: "연합뉴스", url: "https://www.google.com/search?q=SK하이닉스+외국인+기관", published_at: "어제", sentiment: "positive" },
    ],
    aiReport: "SK하이닉스는 엔비디아와의 HBM3E 독점 공급 협력으로 AI 메모리 시장의 최대 수혜주로 부상하고 있습니다.",
    aiWarning: "고점 부근에서의 밸류에이션 부담과 글로벌 IT 수요 둔화 가능성은 모니터링이 필요합니다.",
  },
  {
    name: "테슬라", code: "TSLA", aliases: ["tesla", "tsla"],
    price: "$184.88", change: "-3.12 (-1.66%)", isPositive: false,
    predict7d: "$180.50", range: "$170 ~ $195 구간",
    sentiment: "부정 우세", sentimentSub: "긍정 35% / 부정 55%",
    newsCount: "42건", newsStatus: "충분",
    chartData: [192, 190, 189, 186, 183, 187, 184.88],
    news: [
      { title: "Tesla EV demand slowing in Europe", source: "Reuters", url: "https://www.google.com/search?q=Tesla+EV+demand+slowing", published_at: "2h ago", sentiment: "negative" },
      { title: "Musk hints at new affordable model", source: "Bloomberg", url: "https://www.google.com/search?q=Tesla+affordable+model", published_at: "5h ago", sentiment: "positive" },
      { title: "Tesla China sales drop 15% MoM", source: "WSJ", url: "https://www.google.com/search?q=Tesla+China+sales+drop", published_at: "yesterday", sentiment: "negative" },
    ],
    aiReport: "테슬라는 유럽과 중국 시장에서의 수요 둔화가 지속되며 단기 하락 압력을 받고 있습니다.",
    aiWarning: "머스크의 저가형 신모델 발표 힌트는 반등 모멘텀이 될 수 있으나, 실제 출시까지는 불확실성이 높습니다.",
  },
  {
    name: "Apple", code: "AAPL", aliases: ["애플", "apple", "aapl"],
    price: "$214.32", change: "+2.11 (+0.99%)", isPositive: true,
    predict7d: "$220.00", range: "$205 ~ $230 구간",
    sentiment: "중립 혼재", sentimentSub: "긍정 46% / 부정 44%",
    newsCount: "19건", newsStatus: "적정",
    chartData: [210, 211, 209, 212, 213, 212, 214.32],
    news: [
      { title: "Apple Intelligence AI features expand", source: "TechCrunch", url: "https://www.google.com/search?q=Apple+Intelligence+AI", published_at: "1h ago", sentiment: "positive" },
      { title: "iPhone demand mixed across markets", source: "FT", url: "https://www.google.com/search?q=iPhone+demand+mixed", published_at: "4h ago", sentiment: "negative" },
      { title: "Services revenue hits all-time high", source: "CNBC", url: "https://www.google.com/search?q=Apple+services+revenue+record", published_at: "yesterday", sentiment: "positive" },
    ],
    aiReport: "애플은 AI 기능 확장과 서비스 매출 신기록으로 긍정적 모멘텀을 보이고 있으나, 하드웨어 수요 혼재로 감성 신호가 중립에 가깝습니다.",
    aiWarning: "긍정과 부정 신호가 거의 동등하게 혼재하여 방향성 판단이 어렵습니다.",
  }
];

function AppInner() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState(MOCK_STOCKS[0]);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('삼성전자 (005930.KS)');

  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const [favs, hist] = await Promise.all([getFavorites(firebaseUser.uid), getHistory(firebaseUser.uid)]);
          setFavorites(favs);
          setHistory(hist);
          if (favs.length > 0) {
            const first = favs[0];
            const stock = MOCK_STOCKS.find(s => s.code === first.ticker) ?? {
              name: first.name, code: first.ticker,
              price: '-', change: '-', isPositive: true,
              predict7d: '-', range: '-', sentiment: '-', sentimentSub: '-',
              newsCount: '-', newsStatus: '적정', chartData: [], news: [], aiReport: '', aiWarning: '',
            };
            handleAnalyze(stock);
          } else {
            handleAnalyze(MOCK_STOCKS[0]);
          }
        } catch (e) {
          handleAnalyze(MOCK_STOCKS[0]);
        }
      } else {
        setUser(null); setFavorites([]); setHistory([]);
        handleAnalyze(MOCK_STOCKS[0]);
      }
    });
    return () => unsubscribe();
  }, []);

  const isFavorite = favorites.some(f => f.ticker === selectedStock.code);

  const handleToggleFavorite = async () => {
    if (!user) {
      setToast('로그인이 필요한 기능입니다');
      setTimeout(() => setToast(''), 2500);
      return;
    }
    if (isFavorite) {
      setFavorites(prev => prev.filter(f => f.ticker !== selectedStock.code));
      try { await removeFavorite(user.uid, selectedStock.code); }
      catch (e) { setFavorites(prev => [...prev, { ticker: selectedStock.code, name: selectedStock.name }]); }
    } else {
      setFavorites(prev => [...prev, { ticker: selectedStock.code, name: selectedStock.name }]);
      try { await addFavorite(user.uid, selectedStock.code, selectedStock.name); }
      catch (e) { setFavorites(prev => prev.filter(f => f.ticker !== selectedStock.code)); }
    }
  };

  const handleAnalyze = async (stock) => {
    setSelectedStock(stock);
    setSearchTerm(`${stock.name} (${stock.code})`);
    setIsLoading(true);
    setAnalysis(null);

    const msgs = [
      '뉴스 및 주가 데이터 수집 중...',
      'FinBERT 감성 분석 중...',
      'Prophet 7일 예측 계산 중... (약 30~60초 소요)',
      'Critic 에이전트 신뢰도 검토 중...',
    ];
    let msgIdx = 0;
    setLoadingMsg(msgs[0]);
    const msgTimer = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, msgs.length - 1);
      setLoadingMsg(msgs[msgIdx]);
    }, 12000);

    try {
      const data = await analyzeStock(stock.code);
      clearInterval(msgTimer);
      setLoadingMsg('');
      setAnalysis(data);
    } catch (e) {
      clearInterval(msgTimer);
      setLoadingMsg('');
    } finally {
      setIsLoading(false);
      if (user) {
        saveHistory(user.uid, stock.code, stock.name)
          .then(() => getHistory(user.uid))
          .then(updated => setHistory(updated))
          .catch(() => {});
      }
      getRelatedStocks(stock.code)
        .then(results => setRecommendations(results))
        .catch(() => setRecommendations([]));
    }
  };

  return (
    <div className={`app-layout${isDarkMode ? ' dark' : ''}`}>
      <Sidebar
        user={user}
        setUser={setUser}
        setFavorites={setFavorites}
        setHistory={setHistory}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
      <main className="app-main">
        <Routes>
          <Route path="/" element={
            <AnalysisPage
              selectedStock={selectedStock}
              analysis={analysis}
              isLoading={isLoading}
              loadingMsg={loadingMsg}
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
              onAnalyze={handleAnalyze}
              user={user}
              favorites={favorites}
              history={history}
              recommendations={recommendations}
              onRemoveFavorite={async (ticker) => {
                await removeFavorite(user.uid, ticker);
                setFavorites(prev => prev.filter(f => f.ticker !== ticker));
              }}
              onDeleteHistory={async (ticker) => {
                await deleteHistory(user.uid, ticker);
                setHistory(prev => prev.filter(h => h.ticker !== ticker));
              }}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          } />
          <Route path="/favorites" element={
            <FavoritesPage
              favorites={favorites}
              onRemoveFavorite={async (ticker) => {
                await removeFavorite(user.uid, ticker);
                setFavorites(prev => prev.filter(f => f.ticker !== ticker));
              }}
              onAnalyze={handleAnalyze}
            />
          } />
          <Route path="/history" element={
            <HistoryPage
              history={history}
              onDeleteHistory={async (ticker) => {
                await deleteHistory(user.uid, ticker);
                setHistory(prev => prev.filter(h => h.ticker !== ticker));
              }}
              onAnalyze={handleAnalyze}
            />
          } />
          <Route path="/mypage" element={
            <MyPage
              user={user}
              setUser={setUser}
              setFavorites={setFavorites}
              setHistory={setHistory}
              favorites={favorites}
              history={history}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
            />
          } />
          <Route path="/community" element={<CommunityPage user={user} />} />
          <Route path="/community/:postId" element={<PostDetailPage user={user} />} />
        </Routes>
      </main>
      {toast && <div className="login-toast">{toast}</div>}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
