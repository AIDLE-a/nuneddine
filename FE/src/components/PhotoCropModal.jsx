import React, { useRef, useState, useEffect, useCallback } from 'react';

const CANVAS_SIZE = 300;
const DISPLAY_SIZE = 280;

function PhotoCropModal({ file, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const [img, setImg] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      const fit = Math.max(CANVAS_SIZE / image.width, CANVAS_SIZE / image.height);
      setScale(fit);
      setOffset({ x: (CANVAS_SIZE - image.width * fit) / 2, y: (CANVAS_SIZE - image.height * fit) / 2 });
    };
    image.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(image.src);
  }, [file]);

  const draw = useCallback(() => {
    if (!img || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    // 원형 마스크 오버레이
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 원형 테두리
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [img, offset, scale]);

  useEffect(() => { draw(); }, [draw]);

  const clampOffset = (ox, oy, s) => {
    if (!img) return { x: ox, y: oy };
    const w = img.width * s;
    const h = img.height * s;
    return {
      x: Math.min(0, Math.max(CANVAS_SIZE - w, ox)),
      y: Math.min(0, Math.max(CANVAS_SIZE - h, oy)),
    };
  };

  const onMouseDown = (e) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => clampOffset(prev.x + dx, prev.y + dy, scale));
  };
  const onMouseUp = () => { dragging.current = false; };

  const onTouchStart = (e) => { dragging.current = true; lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - lastPos.current.x;
    const dy = e.touches[0].clientY - lastPos.current.y;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setOffset(prev => clampOffset(prev.x + dx, prev.y + dy, scale));
  };

  const onWheel = (e) => {
    e.preventDefault();
    const newScale = Math.max(scale * (e.deltaY < 0 ? 1.05 : 0.95), Math.max(CANVAS_SIZE / (img?.width || 1), CANVAS_SIZE / (img?.height || 1)));
    const clamped = clampOffset(offset.x, offset.y, newScale);
    setScale(newScale);
    setOffset(clamped);
  };

  const handleConfirm = () => {
    if (!img || !canvasRef.current) return;
    // 원형으로 크롭된 결과만 새 캔버스에 그리기
    const out = document.createElement('canvas');
    out.width = CANVAS_SIZE;
    out.height = CANVAS_SIZE;
    const ctx = out.getContext('2d');
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);
    out.toBlob(blob => onConfirm(blob), 'image/jpeg', 0.85);
  };

  return (
    <div className="crop-modal-backdrop" onClick={onCancel}>
      <div className="crop-modal" onClick={e => e.stopPropagation()}>
        <h3 className="crop-modal-title">프로필 사진 편집</h3>
        <p className="crop-modal-sub">드래그로 위치 조정 · 스크롤로 크기 조정</p>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE, cursor: 'grab', borderRadius: '50%', display: 'block', margin: '0 auto' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onMouseUp}
          onWheel={onWheel}
        />
        <div className="crop-modal-actions">
          <button className="btn-cancel" onClick={onCancel}>취소</button>
          <button className="btn-save" onClick={handleConfirm}>저장</button>
        </div>
      </div>
    </div>
  );
}

export default PhotoCropModal;
