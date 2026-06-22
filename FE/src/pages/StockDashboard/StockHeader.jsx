import React, { useState, useRef, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { MOCK_STOCKS } from '../../App.jsx'; // 💡 App.jsx에서 정의한 통합 Mock Data 호출

// 💡 파이어베이스 웹 앱 키값은 기존에 설정하신 실제 데이터로 유지해 주세요!
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 💡 App.jsx로부터 다크모드 관련 및 종목 선택 연동 함수를 받아옵니다.
function StockHeader({ isDarkMode, setIsDarkMode, onSelectStock }) {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("삼성전자 (005930.KS)");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 상위 부모로부터 가져온 MOCK_STOCKS 기준으로 검색 필터링 진행
  const filteredStocks = MOCK_STOCKS.filter(stock => {
    const cleanTerm = searchTerm.replace(/\s*\(.*\)/, "").toLowerCase();
    return (
      stock.name.toLowerCase().includes(cleanTerm) || 
      stock.code.toLowerCase().includes(cleanTerm)
    );
  });

  const handleSelectStock = (stock) => {
    setSearchTerm(`${stock.name} (${stock.code})`);
    setIsDropdownOpen(false);
    
    // 사용자가 고른 주식 개체를 부모에 실어 보내어 대시보드 전체를 바꿉니다.
    if (onSelectStock) {
      onSelectStock(stock);
    }
  };

  // 💡 [클릭 핸들러] 분석 시작 버튼을 눌렀을 때 작동할 함수 대입 ⭐
  const handleAnalysisClick = () => {
    const cleanTerm = searchTerm.replace(/\s*\(.*\)/, "").toLowerCase();
    const matchedStock = MOCK_STOCKS.find(stock => 
      stock.name.toLowerCase().includes(cleanTerm) || 
      stock.code.toLowerCase().includes(cleanTerm)
    );

    if (matchedStock) {
      if (onSelectStock) onSelectStock(matchedStock);
      alert(`🔍 ${matchedStock.name} 실시간 예측 및 데이터 분석을 시작합니다!`);
    } else {
      alert("❌ 올바른 종목명 또는 종목코드를 입력한 후 버튼을 눌러주세요.");
    }
  };

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      
      const response = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.status === "success") {
        setUser(result.user);
        alert(`${result.user.displayName}님, 환영합니다!`);
      }
    } catch (error) {
      console.error("로그인 실패:", error);
      alert("로그인에 실패했습니다.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      alert("로그아웃 되었습니다.");
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  return (
    <div className="search-bar-container">
      {/* [1] 주식 검색창 영역 */}
      <div className="search-input-wrapper" ref={dropdownRef}>
        <input 
          type="text" 
          className="search-input" 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder="종목명 또는 종목코드 입력"
        />
        
        {/* 자동완성 추천 레이어 드롭다운 */}
        {isDropdownOpen && (
          <div className="search-dropdown">
            <div className="dropdown-title">
              {searchTerm.length > 0 && !searchTerm.includes(")") ? "🔍 검색 결과" : "🔥 인기 분석 종목"}
            </div>
            <div className="dropdown-list">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock, idx) => (
                  <div 
                    key={idx} 
                    className="dropdown-item"
                    onClick={() => handleSelectStock(stock)}
                  >
                    <span className="stock-name">{stock.name}</span>
                    <span className="stock-code">{stock.code}</span>
                  </div>
                ))
              ) : (
                <div className="dropdown-no-result">일치하는 종목이 없습니다.</div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* [2] 분석 시작 버튼 (onClick 이벤트 연동 완료 ↗) */}
      <button className="btn-analysis" onClick={handleAnalysisClick}>
        분석 시작 ↗
      </button>

      {/* [3] 다크모드 버튼 (110px 고정 크기) */}
      <button 
        className="btn-theme-toggle" 
        onClick={() => setIsDarkMode(!isDarkMode)}
      >
        {isDarkMode ? '☀️ 라이트모드' : '🌙 다크모드'}
      </button>
      
      {/* [4] 로그인 / 프로필 박스 영역 */}
      {user ? (
        <div className="user-profile-box">
          <span className="user-name">👤 {user.displayName}님</span>
          <button className="btn-header-logout" onClick={handleLogout}>🚪 로그아웃</button>
        </div>
      ) : (
        <button className="btn-header-login" onClick={handleLogin}>🔐 로그인</button>
      )}
    </div>
  );
}

export default StockHeader;