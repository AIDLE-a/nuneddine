import React, { useState, useEffect } from 'react';
import './App.css';

import StockHeader from "./StockHeader.jsx";
import SummaryCards from "./SummaryCards.jsx";
import StockChartCard from "./StockChartCard.jsx";
import ReliabilityCard from "./ReliabilityCard.jsx";
import SentimentCard from "./SentimentCard.jsx";
import RecentNewsCard from "./RecentNewsCard.jsx";
import AiReportCard from "./AiReportCard.jsx";
import { analyzeStock } from './api.js';

export const MOCK_STOCKS = [
  {
    name: "삼성전자", code: "005930.KS",
    price: "72,400원", change: "+1,200 (+1.7%)", isPositive: true,
    predict7d: "73,500원", range: "68k ~ 76k 구간",
    sentiment: "긍정 우세", sentimentSub: "긍정 62% / 부정 31%",
    newsCount: "8건", newsStatus: "권장치 미달",
    chartData: [71200, 71500, 71000, 71800, 72000, 72100, 72400],
    news: [
      { title: "삼성전자, HBM4 양산 일정 앞당겨", source: "한국경제", url: "https://www.google.com/search?q=삼성전자+HBM4+양산+일정+앞당겨", published_at: "2시간 전", sentiment: "positive" },
      { title: "메모리 반도체 수요 둔화 우려 재부각", source: "매일경제", url: "https://www.google.com/search?q=메모리+반도체+수요+둔화+우려+재부각", published_at: "5시간 전", sentiment: "negative" },
      { title: "외국인 순매수 3거래일 연속 이어져", source: "연합뉴스", url: "https://www.google.com/search?q=삼성전자+외국인+순매수+3거래일", published_at: "어제", sentiment: "positive" },
    ],
    aiReport: "삼성전자는 HBM4 양산 일정 조기 착수를 발표하며 AI 메모리 시장에서의 기술 주도권 강화 의지를 확인했습니다. 외국인 순매수 흐름이 3거래일 지속되고 있어 단기 수급은 긍정적으로 판단됩니다.",
    aiWarning: "단, 메모리 수요 둔화에 관한 뉴스가 부정적 신호를 동시에 발생시키고 있으며 이 구간의 예측 신뢰도는 제한적입니다.",
  },
  {
    name: "SK하이닉스", code: "000660.KS",
    price: "168,500원", change: "+4,500 (+2.74%)", isPositive: true,
    predict7d: "172,000원", range: "160k ~ 180k 구간",
    sentiment: "긍정 압도", sentimentSub: "긍정 78% / 부정 12%",
    newsCount: "24건", newsStatus: "충분",
    chartData: [161000, 163000, 162500, 165000, 166000, 164000, 168500],
    news: [
      { title: "SK하이닉스, AI 메모리 수요 급증 수혜", source: "한국경제", url: "https://www.google.com/search?q=SK하이닉스+AI+메모리+수요+급증", published_at: "1시간 전", sentiment: "positive" },
      { title: "HBM3E 엔비디아 독점 공급 계획", source: "서울경제", url: "https://www.google.com/search?q=SK하이닉스+HBM3E+엔비디아+독점+공급", published_at: "3시간 전", sentiment: "positive" },
      { title: "외국인 기관 동반 순매수 지속", source: "연합뉴스", url: "https://www.google.com/search?q=SK하이닉스+외국인+기관+순매수", published_at: "어제", sentiment: "positive" },
    ],
    aiReport: "SK하이닉스는 엔비디아와의 HBM3E 독점 공급 협력으로 AI 메모리 시장의 최대 수혜주로 부상하고 있습니다. 긍정 감성이 압도적으로 우세하며 외국인·기관 동반 순매수가 지속되는 강한 수급을 보입니다.",
    aiWarning: "다만 고점 부근에서의 밸류에이션 부담과 글로벌 IT 수요 둔화 가능성은 모니터링이 필요합니다.",
  },
  {
    name: "테슬라", code: "TSLA",
    price: "$184.88", change: "-3.12 (-1.66%)", isPositive: false,
    predict7d: "$180.50", range: "$170 ~ $195 구간",
    sentiment: "부정 우세", sentimentSub: "긍정 35% / 부정 55%",
    newsCount: "42건", newsStatus: "충분",
    chartData: [192, 190, 189, 186, 183, 187, 184.88],
    news: [
      { title: "Tesla EV demand slowing in Europe", source: "Reuters", url: "https://www.google.com/search?q=Tesla+EV+demand+slowing+Europe", published_at: "2h ago", sentiment: "negative" },
      { title: "Musk hints at new affordable model", source: "Bloomberg", url: "https://www.google.com/search?q=Musk+Tesla+affordable+model+2024", published_at: "5h ago", sentiment: "positive" },
      { title: "Tesla China sales drop 15% MoM", source: "WSJ", url: "https://www.google.com/search?q=Tesla+China+sales+drop", published_at: "yesterday", sentiment: "negative" },
    ],
    aiReport: "테슬라는 유럽과 중국 시장에서의 수요 둔화가 지속되며 단기 하락 압력을 받고 있습니다. 감성 분석 결과 부정적 신호가 우세하며 7일 예측도 하락을 가리킵니다.",
    aiWarning: "머스크의 저가형 신모델 발표 힌트는 반등 모멘텀이 될 수 있으나, 실제 출시까지는 불확실성이 높습니다.",
  },
  {
    name: "Apple", code: "AAPL",
    price: "$214.32", change: "+2.11 (+0.99%)", isPositive: true,
    predict7d: "$220.00", range: "$205 ~ $230 구간",
    sentiment: "중립 혼재", sentimentSub: "긍정 46% / 부정 44%",
    newsCount: "19건", newsStatus: "적정",
    chartData: [210, 211, 209, 212, 213, 212, 214.32],
    news: [
      { title: "Apple Intelligence AI features expand", source: "TechCrunch", url: "https://www.google.com/search?q=Apple+Intelligence+AI+features+2024", published_at: "1h ago", sentiment: "positive" },
      { title: "iPhone demand mixed across markets", source: "FT", url: "https://www.google.com/search?q=iPhone+demand+mixed+markets+2024", published_at: "4h ago", sentiment: "negative" },
      { title: "Services revenue hits all-time high", source: "CNBC", url: "https://www.google.com/search?q=Apple+services+revenue+record+2024", published_at: "yesterday", sentiment: "positive" },
    ],
    aiReport: "애플은 AI 기능 확장과 서비스 매출 신기록으로 긍정적 모멘텀을 보이고 있으나, 하드웨어 수요 혼재로 감성 신호가 중립에 가깝습니다.",
    aiWarning: "긍정과 부정 신호가 거의 동등하게 혼재하여 방향성 판단이 어렵습니다. 추가 데이터 확인 후 의사결정을 권장합니다.",
  }
];

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState(MOCK_STOCKS[0]);
  const [analysis, setAnalysis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const handleAnalyze = async (stock) => {
    setSelectedStock(stock);
    setIsLoading(true);
    setAnalysis(null);
    try {
      const data = await analyzeStock(stock.code);
      setAnalysis(data);
    } catch (e) {
      console.warn("백엔드 미연결 — 목데이터로 표시:", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const hasWarning = !analysis
    ? (selectedStock.newsStatus === '권장치 미달' || selectedStock.sentiment.includes('혼재'))
    : analysis.warnings.length > 0;

  const warningText = analysis
    ? analysis.warnings.join(' · ')
    : `${selectedStock.name} 신뢰도 주의 — 뉴스 데이터 부족 · 감성 혼재 감지. 추가 검토를 권장합니다.`;

  return (
    <div className="dashboard-container">
      <StockHeader
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onSelectStock={handleAnalyze}
      />

      <SummaryCards stock={selectedStock} analysis={analysis} isLoading={isLoading} />

      {hasWarning && (
        <div className="alert-banner">
          ⚠️ {warningText}
        </div>
      )}

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

export default App;
