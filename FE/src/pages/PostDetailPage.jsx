import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPost, getComments, addComment, deletePost, deleteComment, toggleCommentLike, togglePostLike, updateComment, votePoll } from '../firebase.js';

function timeAgo(ts) {
  if (!ts) return '';
  const sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (sec < 60) return '방금 전';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

function Avatar({ photo, name, size = 28 }) {
  return photo
    ? <img src={photo} className="comment-avatar-img" referrerPolicy="no-referrer" alt="" style={{ width: size, height: size }} />
    : <div className="comment-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>{(name?.[0] ?? '?').toUpperCase()}</div>;
}

// 개별 댓글/대댓글 행 — 재사용
function CommentRow({ comment, user, isReply, onLike, onReply, onDelete, onEdit, onRequireLogin }) {
  const [likes, setLikes] = useState(comment.likes ?? []);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [submitting, setSubmitting] = useState(false);
  const liked = user ? likes.includes(user.uid) : false;

  const handleLike = async () => {
    if (!user) { onRequireLogin?.(); return; }
    const newLikes = await onLike(comment.id);
    setLikes(newLikes);
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(replyText.trim(), comment.parentId ?? comment.id);
      setReplyText(''); setReplying(false);
    } finally { setSubmitting(false); }
  };

  const handleEditSubmit = async () => {
    if (!editText.trim()) return;
    setSubmitting(true);
    try {
      await onEdit(comment.id, editText.trim());
      setEditing(false);
    } finally { setSubmitting(false); }
  };

  return (
    <div className={`comment-row${isReply ? ' reply' : ''}`}>
      <div className="comment-main">
        <Avatar photo={comment.authorPhoto} name={comment.authorName} size={isReply ? 24 : 28} />
        <div className="comment-body">
          <div className="comment-meta">
            <span className="comment-author">{comment.authorName}</span>
            <span className="comment-time">{timeAgo(comment.createdAt)}</span>
            {comment.editedAt && <span className="comment-edited">(수정됨)</span>}
          </div>
          {editing ? (
            <div className="reply-write-box">
              <textarea
                className="reply-input"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="post-write-actions">
                <button className="btn-cancel" onClick={() => { setEditing(false); setEditText(comment.content); }}>취소</button>
                <button className="btn-save" onClick={handleEditSubmit} disabled={submitting || !editText.trim()}>
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <p className="comment-content">{comment.content}</p>
          )}
          <div className="comment-actions">
            <button className={`comment-like-btn${liked ? ' liked' : ''}`} onClick={handleLike} disabled={!user}>
              {liked ? '❤️' : '🤍'}{likes.length > 0 && <span>{likes.length}</span>}
            </button>
            <button className="comment-action-btn" onClick={() => user ? setReplying(v => !v) : onRequireLogin?.()}>답글</button>
            {user?.uid === comment.authorUid && (
              <>
                <button className="comment-action-btn" onClick={() => { setEditing(true); setReplying(false); }}>수정</button>
                <button className="comment-action-btn danger" onClick={() => onDelete(comment.id)}>삭제</button>
              </>
            )}
          </div>
          {replying && (
            <div className="reply-write-box">
              <textarea
                className="reply-input"
                placeholder="답글을 입력하세요"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="post-write-actions">
                <button className="btn-cancel" onClick={() => { setReplying(false); setReplyText(''); }}>취소</button>
                <button className="btn-save" onClick={handleReplySubmit} disabled={submitting || !replyText.trim()}>
                  {submitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostDetailPage({ user }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [postLikes, setPostLikes] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState(null); // 현재 확대 중인 이미지 인덱스

  const openLightbox = (idx) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const lightboxImages = post?.imageUrls ?? [];
  const showPrev = () => setLightboxIdx(i => (i - 1 + lightboxImages.length) % lightboxImages.length);
  const showNext = () => setLightboxIdx(i => (i + 1) % lightboxImages.length);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') showNext();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, lightboxImages.length]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const requireLogin = () => { showToast('로그인이 필요한 기능입니다'); return false; };

  const reload = async () => {
    const [p, c] = await Promise.all([getPost(postId), getComments(postId)]);
    setPost(p);
    setPostLikes(p?.likes ?? []);
    setComments(c);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [postId]);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await addComment(user, postId, commentText.trim(), null);
      setCommentText('');
      await reload();
    } finally { setSubmitting(false); }
  };

  const handleReply = async (text, parentId) => {
    await addComment(user, postId, text, parentId);
    await reload();
  };

  const handleDeleteComment = async (commentId) => {
    await deleteComment(postId, commentId);
    await reload();
  };

  const handleEditComment = async (commentId, content) => {
    await updateComment(postId, commentId, content);
    await reload();
  };

  const handleCommentLike = async (commentId) => {
    return await toggleCommentLike(postId, commentId, user.uid);
  };

  const handlePostLike = async () => {
    if (!user) { requireLogin(); return; }
    const newLikes = await togglePostLike(postId, user.uid);
    setPostLikes(newLikes);
  };

  const handleDeletePost = async () => {
    if (!window.confirm('게시글을 삭제할까요?')) return;
    await deletePost(postId);
    navigate('/community');
  };

  if (loading) return <div className="page-content"><div className="community-empty">불러오는 중...</div></div>;
  if (!post) return <div className="page-content"><div className="community-empty">게시글을 찾을 수 없습니다.</div></div>;

  const topComments = comments.filter(c => !c.parentId);
  const getReplies = (commentId) => comments.filter(c => c.parentId === commentId);
  const postLiked = user ? postLikes.includes(user.uid) : false;

  return (
    <div className="page-content">
      <button className="post-back-btn" onClick={() => navigate('/community')}>← 목록으로</button>

      <div className="post-detail-card">
        <div className="post-author" style={{ marginBottom: 12 }}>
          <Avatar photo={post.authorPhoto} name={post.authorName} />
          <span className="post-author-name">{post.authorName}</span>
          <span className="post-time">{timeAgo(post.createdAt)}</span>
          {user?.uid === post.authorUid && (
            <button className="comment-action-btn danger" style={{ marginLeft: 'auto' }} onClick={handleDeletePost}>삭제</button>
          )}
        </div>
        <h2 className="post-detail-title">{post.title}</h2>
        <p className="post-detail-content">{post.content}</p>

        {/* 이미지 */}
        {post.imageUrls?.length > 0 && (
          <div className="post-image-row">
            {post.imageUrls.map((url, i) => (
              <div key={i} className="post-image-square" onClick={() => openLightbox(i)}>
                <img src={url} alt="" />
              </div>
            ))}
          </div>
        )}

        {/* 투표 */}
        {post.poll && (
          <div className="post-poll">
            <div className="post-poll-title">📊 투표</div>
            {post.poll.options.map((opt, i) => {
              const totalVotes = post.poll.options.reduce((s, o) => s + (o.votes?.length ?? 0), 0);
              const myVote = user && (opt.votes ?? []).includes(user.uid);
              const pct = totalVotes > 0 ? Math.round((opt.votes?.length ?? 0) / totalVotes * 100) : 0;
              return (
                <div key={i} className="poll-option" onClick={async () => {
                  if (!user) { requireLogin(); return; }
                  await votePoll(postId, i, user.uid);
                  await reload();
                }}>
                  <div className="poll-option-bar" style={{ width: `${pct}%` }} />
                  <span className={`poll-option-label${myVote ? ' my-vote' : ''}`}>{opt.text}</span>
                  <span className="poll-option-pct">{pct}% ({opt.votes?.length ?? 0})</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="post-like-row">
          <button className={`post-like-btn${postLiked ? ' liked' : ''}`} onClick={handlePostLike} disabled={!user}>
            {postLiked ? '❤️' : '🤍'} 공감 {postLikes.length > 0 && <span className="post-like-count">{postLikes.length}</span>}
          </button>
          <span className="post-comment-stat">💬 댓글 {comments.length}개</span>
        </div>
      </div>

      <div className="comments-section">
        <h3 className="comments-title">댓글 {comments.length}개</h3>
        {topComments.map((comment, idx) => (
          <div key={comment.id} className={`comment-group${idx < topComments.length - 1 ? ' has-border' : ''}`}>
            <CommentRow
              comment={comment}
              user={user}
              isReply={false}
              onLike={handleCommentLike}
              onReply={handleReply}
              onDelete={handleDeleteComment}
              onEdit={handleEditComment}
              onRequireLogin={requireLogin}
            />
            {getReplies(comment.id).map(reply => (
              <CommentRow
                key={reply.id}
                comment={reply}
                user={user}
                isReply={true}
                onLike={handleCommentLike}
                onReply={handleReply}
                onDelete={handleDeleteComment}
                onEdit={handleEditComment}
                onRequireLogin={requireLogin}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="comment-write-box">
        {user && <Avatar photo={user.photoURL} name={user.displayName} />}
        <div className="comment-write-inner">
          <textarea
            className="reply-input"
            placeholder={user ? "댓글을 입력하세요" : "로그인 후 댓글을 작성할 수 있습니다"}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onFocus={() => { if (!user) requireLogin(); }}
            rows={2}
            readOnly={!user}
          />
          {user && (
            <div className="post-write-actions">
              <button className="btn-save" onClick={handleComment} disabled={submitting || !commentText.trim()}>
                {submitting ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="login-toast">{toast}</div>}

      {lightboxIdx !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>✕</button>
          {lightboxImages.length > 1 && (
            <button className="lightbox-nav prev" onClick={e => { e.stopPropagation(); showPrev(); }}>‹</button>
          )}
          <img src={lightboxImages[lightboxIdx]} className="lightbox-img" alt="" onClick={e => e.stopPropagation()} />
          {lightboxImages.length > 1 && (
            <button className="lightbox-nav next" onClick={e => { e.stopPropagation(); showNext(); }}>›</button>
          )}
          {lightboxImages.length > 1 && (
            <div className="lightbox-counter">{lightboxIdx + 1} / {lightboxImages.length}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default PostDetailPage;
