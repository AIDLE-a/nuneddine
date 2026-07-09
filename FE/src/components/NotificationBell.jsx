import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, markNotificationRead, markAllNotificationsRead, getNotifSettings } from '../firebase.js';

function timeAgo(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (sec < 60) return '방금 전';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

function notifText(n) {
  switch (n.type) {
    case 'like_post':     return `${n.fromName}님이 내 게시글을 공감했어요`;
    case 'comment_post':  return `${n.fromName}님이 내 게시글에 댓글을 남겼어요`;
    case 'like_comment':  return `${n.fromName}님이 내 댓글을 공감했어요`;
    case 'reply_comment': return `${n.fromName}님이 내 댓글에 대댓글을 남겼어요`;
    default: return '새 알림이 있어요';
  }
}

export default function NotificationBell({ user }) {
  const [notifs, setNotifs] = useState([]);
  const [settings, setSettings] = useState({});
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications', user.uid, 'items'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    // 본인 설정은 본인 문서라 읽기 가능
    getNotifSettings(user.uid).then(s => setSettings(s)).catch(() => {});
    return () => unsub();
  }, [user?.uid]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 사용자가 끈 타입은 뱃지·목록에서 제외
  const visibleNotifs = notifs.filter(n => settings[n.type] !== false);
  const unreadCount = visibleNotifs.filter(n => !n.read).length;

  const handleClick = async (n) => {
    if (!n.read) await markNotificationRead(user.uid, n.id).catch(() => {});
    setOpen(false);
    navigate(`/community/${n.postId}`);
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead(user.uid).catch(() => {});
  };

  if (!user) return null;

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className="notif-bell-btn" onClick={() => setOpen(v => !v)} title="알림">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">알림</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>모두 읽음</button>
            )}
          </div>
          <div className="notif-list">
            {visibleNotifs.length === 0 ? (
              <div className="notif-empty">새 알림이 없어요</div>
            ) : visibleNotifs.map(n => (
              <div
                key={n.id}
                className={`notif-item${n.read ? ' read' : ''}`}
                onClick={() => handleClick(n)}
              >
                <div className="notif-dot-wrap">
                  {!n.read && <span className="notif-unread-dot" />}
                </div>
                <div className="notif-content">
                  <p className="notif-text">{notifText(n)}</p>
                  {n.postTitle && <p className="notif-sub">"{n.postTitle}"</p>}
                  <p className="notif-time">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
