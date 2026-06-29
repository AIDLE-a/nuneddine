import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from './firebase.js';

function Sidebar({ user, setUser, setFavorites, setHistory, isDarkMode, setIsDarkMode }) {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) { console.error('로그인 실패:', e); }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null); setFavorites([]); setHistory([]);
      navigate('/');
    } catch (e) { console.error('로그아웃 실패:', e); }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : null;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
          <rect width="32" height="32" rx="9" fill="#0F172A"/>
          <line x1="8" y1="7" x2="8" y2="10" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="5.5" y="10" width="5" height="7" rx="1" fill="#EF4444"/>
          <line x1="8" y1="17" x2="8" y2="21" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="5" x2="16" y2="9" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="13.5" y="9" width="5" height="8" rx="1" fill="#22C55E"/>
          <line x1="16" y1="17" x2="16" y2="20" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="24" y1="8" x2="24" y2="12" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
          <rect x="21.5" y="12" width="5" height="6" rx="1" fill="#22C55E"/>
          <line x1="24" y1="18" x2="24" y2="22" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="5,26 10,24 16,25 22,22 27,23" fill="none" stroke="#FACC15" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span>Nune<em>DD</em>ine</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          분석
        </NavLink>
        {user && (
          <>
            <NavLink to="/favorites" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              관심 종목
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              분석 기록
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="sidebar-theme-btn"
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode
            ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> 라이트 모드</>
            : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> 다크 모드</>
          }
        </button>

        {user ? (
          <NavLink to="/mypage" className={({ isActive }) => `sidebar-user${isActive ? ' active' : ''}`}>
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.displayName}</span>
              <span className="sidebar-user-sub">마이페이지</span>
            </div>
          </NavLink>
        ) : (
          <button className="sidebar-login-btn" onClick={handleLogin}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            구글 로그인
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
