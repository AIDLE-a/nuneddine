import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { useNavigate } from 'react-router-dom';

function MyPage({ user, setUser, setFavorites, setHistory, favorites, history, isDarkMode, setIsDarkMode }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null); setFavorites([]); setHistory([]);
      navigate('/');
    } catch (e) { console.error('로그아웃 실패:', e); }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">마이페이지</h1>
      </div>

      {/* 프로필 카드 */}
      <div className="mypage-profile-card">
        <div className="mypage-avatar">{initials}</div>
        <div className="mypage-profile-info">
          <h2 className="mypage-name">{user?.displayName ?? '사용자'}</h2>
          <p className="mypage-email">{user?.email ?? ''}</p>
        </div>
      </div>

      {/* 통계 */}
      <div className="mypage-stats">
        <div className="mypage-stat-card">
          <p className="mypage-stat-value">{favorites.length}</p>
          <p className="mypage-stat-label">관심 종목</p>
        </div>
        <div className="mypage-stat-card">
          <p className="mypage-stat-value">{history.length}</p>
          <p className="mypage-stat-label">분석 기록</p>
        </div>
      </div>

      {/* 설정 섹션 */}
      <div className="mypage-section">
        <h3 className="mypage-section-title">설정</h3>
        <div className="mypage-setting-row">
          <div>
            <p className="mypage-setting-label">다크 모드</p>
            <p className="mypage-setting-sub">어두운 배경으로 전환합니다</p>
          </div>
          <button
            className={`toggle-switch${isDarkMode ? ' on' : ''}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="다크 모드 토글"
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>

      {/* 계정 섹션 */}
      <div className="mypage-section">
        <h3 className="mypage-section-title">계정</h3>
        <div className="mypage-setting-row">
          <div>
            <p className="mypage-setting-label">로그아웃</p>
            <p className="mypage-setting-sub">현재 계정에서 로그아웃합니다</p>
          </div>
          <button className="btn-danger-outline" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}

export default MyPage;
