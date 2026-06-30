import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPost, getComments, addComment, deletePost, deleteComment } from '../firebase.js';

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

function CommentItem({ comment, replies, user, postId, onDelete, onReply }) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReplySubmit = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(replyText.trim(), comment.id);
      setReplyText(''); setReplying(false);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="comment-item">
      <div className="comment-main">
        <Avatar photo={comment.authorPhoto} name={comment.authorName} />
        <div className="comment-body">
          <div className="comment-meta">
            <span className="comment-author">{comment.authorName}</span>
            <span className="comment-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="comment-content">{comment.content}</p>
          <div className="comment-actions">
            {user && (
              <button className="comment-action-btn" onClick={() => setReplying(v => !v)}>답글</button>
            )}
            {user?.uid === comment.authorUid && (
              <button className="comment-action-btn danger" onClick={() => onDelete(comment.id)}>삭제</button>
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

      {/* 대댓글 */}
      {replies.length > 0 && (
        <div className="replies">
          {replies.map(reply => (
            <div key={reply.id} className="comment-item reply">
              <div className="comment-main">
                <Avatar photo={reply.authorPhoto} name={reply.authorName} size={24} />
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-author">{reply.authorName}</span>
                    <span className="comment-time">{timeAgo(reply.createdAt)}</span>
                  </div>
                  <p className="comment-content">{reply.content}</p>
                  {user?.uid === reply.authorUid && (
                    <div className="comment-actions">
                      <button className="comment-action-btn danger" onClick={() => onDelete(reply.id)}>삭제</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostDetailPage({ user }) {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [p, c] = await Promise.all([getPost(postId), getComments(postId)]);
    setPost(p); setComments(c);
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

  const handleDeletePost = async () => {
    if (!window.confirm('게시글을 삭제할까요?')) return;
    await deletePost(postId);
    navigate('/community');
  };

  if (loading) return <div className="page-content"><div className="community-empty">불러오는 중...</div></div>;
  if (!post) return <div className="page-content"><div className="community-empty">게시글을 찾을 수 없습니다.</div></div>;

  const topComments = comments.filter(c => !c.parentId);
  const getReplies = (commentId) => comments.filter(c => c.parentId === commentId);

  return (
    <div className="page-content">
      <button className="post-back-btn" onClick={() => navigate('/community')}>← 목록으로</button>

      {/* 게시글 */}
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
      </div>

      {/* 댓글 목록 */}
      <div className="comments-section">
        <h3 className="comments-title">댓글 {comments.length}개</h3>
        {topComments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={getReplies(comment.id)}
            user={user}
            postId={postId}
            onDelete={handleDeleteComment}
            onReply={handleReply}
          />
        ))}
      </div>

      {/* 댓글 작성 */}
      {user ? (
        <div className="comment-write-box">
          <Avatar photo={user.photoURL} name={user.displayName} />
          <div className="comment-write-inner">
            <textarea
              className="reply-input"
              placeholder="댓글을 입력하세요"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              rows={2}
            />
            <div className="post-write-actions">
              <button className="btn-save" onClick={handleComment} disabled={submitting || !commentText.trim()}>
                {submitting ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="community-empty" style={{ fontSize: 13 }}>로그인 후 댓글을 작성할 수 있습니다.</p>
      )}
    </div>
  );
}

export default PostDetailPage;
