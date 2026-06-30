import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts, createPost } from '../firebase.js';

function timeAgo(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (sec < 60) return '방금 전';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

function CommunityPage({ user }) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getPosts().then(p => { setPosts(p); setLoading(false); });
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await createPost(user, title.trim(), content.trim());
      setTitle(''); setContent(''); setWriting(false);
      const updated = await getPosts();
      setPosts(updated);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPosts = searchQuery.trim()
    ? posts.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.authorName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">커뮤니티</h1>
        {user && !writing && (
          <button className="btn-write" onClick={() => setWriting(true)}>글쓰기</button>
        )}
      </div>

      {/* 검색 */}
      <div className="community-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="community-search-input"
          placeholder="제목, 내용, 작성자 검색"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="community-search-clear" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {writing && (
        <div className="post-write-box">
          <input
            className="post-write-title"
            placeholder="제목을 입력하세요"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
          />
          <textarea
            className="post-write-content"
            placeholder="내용을 입력하세요"
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={5}
          />
          <div className="post-write-actions">
            <button className="btn-cancel" onClick={() => { setWriting(false); setTitle(''); setContent(''); }}>취소</button>
            <button className="btn-save" onClick={handleSubmit} disabled={submitting || !title.trim() || !content.trim()}>
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="community-empty">불러오는 중...</div>
      ) : filteredPosts.length === 0 ? (
        <div className="community-empty">
          {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다.` : '첫 번째 글을 작성해보세요!'}
        </div>
      ) : (
        <div className="post-list">
          {filteredPosts.map(post => (
            <div key={post.id} className="post-card" onClick={() => navigate(`/community/${post.id}`)}>
              <div className="post-card-header">
                <div className="post-author">
                  {post.authorPhoto
                    ? <img src={post.authorPhoto} className="comment-avatar-img" referrerPolicy="no-referrer" alt="" />
                    : <div className="comment-avatar">{(post.authorName?.[0] ?? '?').toUpperCase()}</div>
                  }
                  <span className="post-author-name">{post.authorName}</span>
                  <span className="post-time">{timeAgo(post.createdAt)}</span>
                </div>
                <span className="post-comment-count">💬 {post.commentCount ?? 0}</span>
              </div>
              <h3 className="post-title">{post.title}</h3>
              <p className="post-preview">{post.content.slice(0, 100)}{post.content.length > 100 ? '...' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommunityPage;
