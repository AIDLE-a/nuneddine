import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPost, uploadPostImages, db } from '../firebase.js';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

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
  const [toast, setToast] = useState('');
  const [images, setImages] = useState([]); // File[]
  const [imagePreviews, setImagePreviews] = useState([]);
  const [pollOptions, setPollOptions] = useState([]); // string[]
  const [pollInput, setPollInput] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files);
    const remaining = 5 - images.length;
    const added = files.slice(0, remaining);
    setImages(prev => [...prev, ...added]);
    setImagePreviews(prev => [...prev, ...added.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const addPollOption = () => {
    if (!pollInput.trim()) return;
    setPollOptions(prev => [...prev, pollInput.trim()]);
    setPollInput('');
  };

  const removePollOption = (idx) => setPollOptions(prev => prev.filter((_, i) => i !== idx));

  // 실시간 구독 — 공감수 변경 즉시 반영
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const postId = crypto.randomUUID();
      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await uploadPostImages(postId, images);
      }
      const poll = pollOptions.length > 0
        ? { options: pollOptions.map(text => ({ text, votes: [] })) }
        : null;
      await createPost(user, title.trim(), content.trim(), imageUrls, poll, postId);
      setTitle(''); setContent(''); setWriting(false);
      setImages([]); setImagePreviews([]); setPollOptions([]); setPollInput('');
    } finally {
      setSubmitting(false);
    }
  };

  const hotPosts = posts.filter(p => (p.likes?.length ?? 0) >= 10);

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
        <button className="btn-write" onClick={() => user ? setWriting(true) : showToast('로그인이 필요한 기능입니다')}>글쓰기</button>
      </div>

      {/* HOT 게시글 */}
      {hotPosts.length > 0 && (
        <div className="hot-posts-section">
          <div className="hot-posts-label">🔥 지금 HOT한 글!</div>
          {hotPosts.map(post => (
            <div key={post.id} className="hot-post-item" onClick={() => navigate(`/community/${post.id}`)}>
              <span className="hot-post-title">{post.title}</span>
              <span className="hot-post-likes">❤️ {post.likes?.length ?? 0}</span>
            </div>
          ))}
        </div>
      )}

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

          {/* 사진 첨부 */}
          <div className="post-image-section">
            <div className="post-image-previews">
              {imagePreviews.map((src, i) => (
                <div key={i} className="post-image-thumb">
                  <img src={src} alt="" />
                  <button className="post-image-remove" onClick={() => removeImage(i)}>✕</button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="post-image-add">
                  <input type="file" accept="image/*" multiple onChange={handleImageAdd} style={{ display: 'none' }} />
                  <span>📷 {images.length > 0 ? `${images.length}/5` : '사진 추가'}</span>
                </label>
              )}
            </div>
          </div>

          {/* 투표 */}
          <div className="post-poll-section">
            <div className="post-poll-label">📊 투표 추가 (선택)</div>
            {pollOptions.map((opt, i) => (
              <div key={i} className="poll-option-row">
                <span className="poll-option-text">{opt}</span>
                <button className="poll-option-remove" onClick={() => removePollOption(i)}>✕</button>
              </div>
            ))}
            <div className="poll-input-row">
              <input
                className="poll-option-input"
                placeholder="항목 입력 후 + 클릭"
                value={pollInput}
                onChange={e => setPollInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPollOption()}
              />
              <button className="poll-option-add-btn" onClick={addPollOption}>+</button>
            </div>
          </div>

          <div className="post-write-actions">
            <button className="btn-cancel" onClick={() => { setWriting(false); setTitle(''); setContent(''); setImages([]); setImagePreviews([]); setPollOptions([]); }}>취소</button>
            <button className="btn-save" onClick={handleSubmit} disabled={submitting || !title.trim() || !content.trim()}>
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {toast && <div className="login-toast">{toast}</div>}

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
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {(post.likes?.length ?? 0) > 0 && <span className="post-comment-count">❤️ {post.likes.length}</span>}
                  <span className="post-comment-count">💬 {post.commentCount ?? 0}</span>
                </div>
              </div>
              <div className="post-card-body">
                <div className="post-card-text">
                  <h3 className="post-title">{post.title}</h3>
                  <p className="post-preview">{post.content.slice(0, 100)}{post.content.length > 100 ? '...' : ''}</p>
                </div>
                {post.imageUrls?.length > 0 && (
                  <img src={post.imageUrls[0]} className="post-thumb" alt="" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommunityPage;
