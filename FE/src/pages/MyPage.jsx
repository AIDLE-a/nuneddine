import React, { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { updateDisplayName, isNameTaken, uploadProfilePhoto, getNotifSettings, updateNotifSettings } from '../firebase.js';
import { useNavigate } from 'react-router-dom';
import PhotoCropModal from '../components/PhotoCropModal.jsx';

function MyPage({ user, setUser, setFavorites, setHistory, favorites, history, isDarkMode, setIsDarkMode }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const [cropFile, setCropFile] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const NOTIF_LABELS = [
    { key: 'like_post',     label: '게시글 공감', sub: '내 게시글에 공감이 달릴 때' },
    { key: 'comment_post',  label: '게시글 댓글', sub: '내 게시글에 댓글이 달릴 때' },
    { key: 'like_comment',  label: '댓글 공감',   sub: '내 댓글에 공감이 달릴 때' },
    { key: 'reply_comment', label: '댓글 대댓글', sub: '내 댓글에 대댓글이 달릴 때' },
  ];
  const [notifSettings, setNotifSettings] = useState({ like_post: true, comment_post: true, like_comment: true, reply_comment: true });

  useEffect(() => {
    if (!user) return;
    getNotifSettings(user.uid).then(s => {
      setNotifSettings({ like_post: true, comment_post: true, like_comment: true, reply_comment: true, ...s });
    });
  }, [user?.uid]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null); setFavorites([]); setHistory([]);
      navigate('/');
    } catch (e) { console.error('로그아웃 실패:', e); }
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('이름을 입력해주세요.'); return; }
    if (trimmed === user?.displayName) { setEditingName(false); return; }
    setNameSaving(true);
    setNameError('');
    try {
      const taken = await isNameTaken(trimmed, user.uid);
      if (taken) { setNameError('이미 사용 중인 이름입니다.'); return; }
      await updateDisplayName(user, trimmed);
      setUser({ ...user, displayName: trimmed });
      setEditingName(false);
    } catch (e) {
      setNameError(e.message ?? '저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNameInput(user?.displayName ?? '');
    setNameError('');
    setEditingName(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('이미지 파일만 업로드할 수 있습니다.'); return; }
    if (file.size > 20 * 1024 * 1024) { setPhotoError('20MB 이하 파일만 선택할 수 있습니다.'); return; }
    setPhotoError('');
    setCropFile(file);
    e.target.value = '';
  };

  const handleCropConfirm = async (blob) => {
    setCropFile(null);
    setPhotoUploading(true);
    try {
      const url = await uploadProfilePhoto(user, blob);
      setUser({ ...user, photoURL: url });
    } catch (e) {
      setPhotoError('업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">마이페이지</h1>
      </div>

      {cropFile && (
        <PhotoCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* 프로필 카드 */}
      <div className="mypage-profile-card">
        <div className="mypage-avatar-wrap">
          {user?.photoURL
            ? <img src={user.photoURL} alt="프로필" className="mypage-avatar-img" referrerPolicy="no-referrer" />
            : <div className="mypage-avatar">{initials}</div>
          }
          <button
            className="mypage-avatar-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoUploading}
            title="프로필 사진 변경"
          >
            {photoUploading ? '…' : '✎'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        <div className="mypage-profile-info">
          {editingName ? (
            <div className="mypage-name-edit">
              <input
                className="mypage-name-input"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelEdit(); }}
                autoFocus
                maxLength={20}
              />
              {nameError && <p className="mypage-name-error">{nameError}</p>}
              <div className="mypage-name-actions">
                <button className="btn-save" onClick={handleSaveName} disabled={nameSaving}>
                  {nameSaving ? '저장 중...' : '저장'}
                </button>
                <button className="btn-cancel" onClick={handleCancelEdit}>취소</button>
              </div>
            </div>
          ) : (
            <div className="mypage-name-row">
              <h2 className="mypage-name">{user?.displayName ?? '사용자'}</h2>
              <button className="btn-edit-name" onClick={() => { setNameInput(user?.displayName ?? ''); setEditingName(true); }}>
                편집
              </button>
            </div>
          )}
          <p className="mypage-email">{user?.email ?? ''}</p>
          {photoError && <p className="mypage-name-error" style={{ marginTop: 4 }}>{photoError}</p>}
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

      {/* 알림 설정 섹션 */}
      <div className="mypage-section">
        <h3 className="mypage-section-title">알림 설정</h3>
        {NOTIF_LABELS.map(({ key, label, sub }) => (
          <div className="mypage-setting-row" key={key}>
            <div>
              <p className="mypage-setting-label">{label}</p>
              <p className="mypage-setting-sub">{sub}</p>
            </div>
            <button
              className={`toggle-switch${notifSettings[key] !== false ? ' on' : ''}`}
              onClick={async () => {
                const next = { ...notifSettings, [key]: notifSettings[key] === false ? true : false };
                setNotifSettings(next);
                await updateNotifSettings(user.uid, next);
              }}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        ))}
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
