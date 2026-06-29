import React, { useState, useRef, useEffect } from 'react';
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from './firebase.js';
import { MOCK_STOCKS } from './App.jsx';

function StockHeader({ isDarkMode, setIsDarkMode, onSelectStock, user, setUser, setFavorites, setHistory }) {
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
    if (onSelectStock) onSelectStock(stock);
  };

  const handleAnalysisClick = () => {
    const cleanTerm = searchTerm.replace(/\s*\(.*\)/, "").toLowerCase();
    const matchedStock = MOCK_STOCKS.find(stock =>
      stock.name.toLowerCase().includes(cleanTerm) ||
      stock.code.toLowerCase().includes(cleanTerm)
    );
    if (matchedStock) {
      if (onSelectStock) onSelectStock(matchedStock);
    } else {
      alert("올바른 종목명 또는 종목코드를 입력한 후 버튼을 눌러주세요.");
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      // App.jsx의 onAuthStateChanged가 자동으로 user 상태 + Firestore 데이터 복구
    } catch (error) {
      console.error("로그인 실패:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setFavorites([]);
      setHistory([]);
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  return (
    <div className="search-bar-container">
      <div className="search-input-wrapper" ref={dropdownRef}>
        <input
          type="text"
          className="search-input"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder="종목명 또는 종목코드 입력"
        />
        {isDropdownOpen && (
          <div className="search-dropdown">
            <div className="dropdown-title">
              {searchTerm.length > 0 && !searchTerm.includes(")") ? "🔍 검색 결과" : "🔥 인기 분석 종목"}
            </div>
            <div className="dropdown-list">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock, idx) => (
                  <div key={idx} className="dropdown-item" onClick={() => handleSelectStock(stock)}>
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

      <button className="btn-analysis" onClick={handleAnalysisClick}>분석 시작 ↗</button>

      <button className="btn-theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
        {isDarkMode ? '☀️ 라이트모드' : '🌙 다크모드'}
      </button>

      {user ? (
        <div className="user-profile-box">
          <img src={user.photoURL} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          <span className="user-name">{user.displayName}님</span>
          <button className="btn-header-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      ) : (
        <button className="btn-header-login" onClick={handleLogin}>🔐 로그인</button>
      )}
    </div>
  );
}

export default StockHeader;
