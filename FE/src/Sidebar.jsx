import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, provider } from './firebase.js';

function Sidebar({ user, setUser, setFavorites, setHistory, isDarkMode, setIsDarkMode, isOpen, onClose }) {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) {
      // 팝업 차단 시 리다이렉트로 폴백 (윈도우/COOP 환경)
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.message?.includes('Cross-Origin')) {
        await signInWithRedirect(auth, provider);
      } else {
        console.error('로그인 실패:', e);
      }
    }
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

  const handleNavClick = () => { if (onClose) onClose(); };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <span>Nune<span className="logo-eye">D</span><span className="logo-eye">D</span>ine</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end onClick={handleNavClick} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          분석
        </NavLink>
        <NavLink to="/community" onClick={handleNavClick} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          커뮤니티
        </NavLink>
        <NavLink to="/ranking" onClick={handleNavClick} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          인기 종목
        </NavLink>
        {user && (
          <>
            <NavLink to="/favorites" onClick={handleNavClick} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              관심 종목
            </NavLink>
            <NavLink to="/history" onClick={handleNavClick} className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}>
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
            {user.photoURL
              ? <img src={user.photoURL} className="sidebar-avatar-img" referrerPolicy="no-referrer" alt="" />
              : <div className="sidebar-avatar">{initials}</div>
            }
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
