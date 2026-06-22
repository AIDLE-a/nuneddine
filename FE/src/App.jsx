import React, { useState, useEffect } from 'react';
import './App.css';

import StockHeader from "./pages/StockDashboard/StockHeader.jsx";
import SummaryCards from "./pages/StockDashboard/SummaryCards.jsx";
import StockChartCard from "./pages/StockDashboard/StockChartCard.jsx";
import ReliabilityCard from "./pages/StockDashboard/ReliabilityCard.jsx";
import SentimentCard from "./pages/StockDashboard/SentimentCard.jsx";
import RecentNewsCard from "./pages/StockDashboard/RecentNewsCard.jsx";
import AiReportCard from "./pages/StockDashboard/AiReportCard.jsx";

// 💡 1. 전역에서 사용할 모의 데이터 정의 (종목별 고유 데이터 부여)
export const MOCK_STOCKS = [
  { 
    name: "삼성전자", code: "005930.KS", 
    price: "72,400원", change: "+1,200 (+1.7%)", isPositive: true,
    predict7d: "73,500원", range: "68k ~ 76k 구간",
    sentiment: "긍정 우세", sentimentSub: "긍정 62% / 부정 31%",
    newsCount: "8건", newsStatus: "권장치 미달",
    chartData: [71200, 71500, 71000, 71800, 72000, 72100, 72400] // 7일간의 주가 흐름
  },
  { 
    name: "SK하이닉스", code: "000660.KS", 
    price: "168,500원", change: "+4,500 (+2.74%)", isPositive: true,
    predict7d: "172,000원", range: "160k ~ 180k 구간",
    sentiment: "긍정 압도", sentimentSub: "긍정 78% / 부정 12%",
    newsCount: "24건", newsStatus: "충분",
    chartData: [161000, 163000, 162500, 165000, 166000, 164000, 168500]
  },
  { 
    name: "테슬라", code: "TSLA", 
    price: "$184.88", change: "-3.12 (-1.66%)", isPositive: false,
    predict7d: "$180.50", range: "$170 ~ $195 구간",
    sentiment: "부정 우세", sentimentSub: "긍정 35% / 부정 55%",
    newsCount: "42건", newsStatus: "충분",
    chartData: [192, 190, 189, 186, 183, 187, 184.88]
  },
  { 
    name: "Apple", code: "AAPL", 
    price: "$214.32", change: "+2.11 (+0.99%)", isPositive: true,
    predict7d: "$220.00", range: "$205 ~ $230 구간",
    sentiment: "중립 혼재", sentimentSub: "긍정 46% / 부정 44%",
    newsCount: "19건", newsStatus: "적정",
    chartData: [210, 211, 209, 212, 213, 212, 214.32]
  }
];

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // 💡 2. 현재 선택된 주식 상태 관리 (기본값: 삼성전자)
  const [selectedStock, setSelectedStock] = useState(MOCK_STOCKS[0]);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  return (
    <div className="dashboard-container">
      {/* 💡 상태 공유를 위해 자식 컴포넌트에 props 전달 */}
      <StockHeader 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        onSelectStock={setSelectedStock} 
      />

      {/* 💡 요약 카드와 차트 카드에 선택된 주식 데이터 주입 */}
      <SummaryCards stock={selectedStock} />

      <div className="alert-banner">
        ⚠️ {selectedStock.name} 신뢰도 주의 — 뉴스 데이터 부족 · 감성 혼재 감지. 추가 검토를 권장합니다.
      </div>

      <div className="main-content-grid">
        <StockChartCard stock={selectedStock} />
        <ReliabilityCard stock={selectedStock} />
      </div>

      <div className="sub-content-grid">
        <SentimentCard stock={selectedStock} />
        <RecentNewsCard stock={selectedStock} />
      </div>

      <AiReportCard stock={selectedStock} />
    </div>
  );
}

export default App;