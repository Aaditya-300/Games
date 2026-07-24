import { useRef, useEffect, useState, useCallback } from 'react';
import socket from '../../socket';

const COLORS = ['#ffffff', '#e53935', '#1e88e5', '#43a047', '#ff6f00', '#9c27b0', '#00acc1', '#000000'];
const LINE_WIDTHS = [3, 6, 12];
const CANVAS_W = 700;
const CANVAS_H = 480;

export default function DrawingCanvas({ isDrawer, drawStrokes }) {
  const canvasRef = useRef(null);
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(6);
  const [isEraser, setIsEraser] = useState(false);
  const drawing = useRef(false);
  const currentPoints = useRef([]);
  // Track how many strokes we've already drawn so we only draw new ones
  const drawnCount = useRef(0);

  const getCtx = () => canvasRef.current?.getContext('2d');

  const drawStroke = useCallback((ctx, stroke) => {
    if (!stroke?.points?.length) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = stroke.points.map(p => ({ x: p.x * CANVAS_W, y: p.y * CANVAS_H }));
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }, []);

  // Replay all strokes when the canvas is cleared (drawStrokes reset to [])
  useEffect(() => {
    if (drawStrokes.length === 0) {
      const ctx = getCtx();
      if (ctx) ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawnCount.current = 0;
      return;
    }

    const ctx = getCtx();
    if (!ctx) return;

    // Only draw newly appended strokes
    const newStrokes = drawStrokes.slice(drawnCount.current);
    for (const stroke of newStrokes) drawStroke(ctx, stroke);
    drawnCount.current = drawStrokes.length;
  }, [drawStrokes, drawStroke]);

  // Mouse / touch helpers
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * scaleX) / CANVAS_W,
      y: ((clientY - rect.top) * scaleY) / CANVAS_H,
    };
  };

  const startDraw = (e) => {
    if (!isDrawer) return;
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    currentPoints.current = [pos];
    const ctx = getCtx();
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x * CANVAS_W, pos.y * CANVAS_H);
    }
  };

  const moveDraw = (e) => {
    if (!isDrawer || !drawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    currentPoints.current.push(pos);
    const ctx = getCtx();
    if (!ctx) return;
    const pts = currentPoints.current;
    const last = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    ctx.strokeStyle = isEraser ? '#1a1a2e' : color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo((last?.x ?? curr.x) * CANVAS_W, (last?.y ?? curr.y) * CANVAS_H);
    ctx.lineTo(curr.x * CANVAS_W, curr.y * CANVAS_H);
    ctx.stroke();
  };

  const endDraw = (e) => {
    if (!isDrawer || !drawing.current) return;
    drawing.current = false;
    if (currentPoints.current.length === 0) return;

    const stroke = {
      points: [...currentPoints.current],
      color: isEraser ? '#1a1a2e' : color,
      lineWidth,
    };
    currentPoints.current = [];
    socket.emit('sk:draw_stroke', { stroke });
    // Add to local drawn count so we don't replay our own stroke
    drawnCount.current++;
  };

  const handleClear = () => {
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawnCount.current = 0;
    socket.emit('sk:clear_canvas');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          background: '#1a1a2e',
          borderRadius: 10,
          border: '2px solid rgba(255,255,255,0.12)',
          cursor: isDrawer ? 'crosshair' : 'default',
          width: '100%',
          maxWidth: CANVAS_W,
          touchAction: 'none',
        }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />

      {isDrawer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Color palette */}
          <div style={{ display: 'flex', gap: 6 }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                style={{
                  width: 26, height: 26, borderRadius: '50%', border: '3px solid',
                  borderColor: !isEraser && color === c ? '#fff' : 'transparent',
                  background: c, cursor: 'pointer', padding: 0,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }}
              />
            ))}
          </div>

          {/* Line widths */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {LINE_WIDTHS.map(w => (
              <button
                key={w}
                onClick={() => { setLineWidth(w); setIsEraser(false); }}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: '2px solid',
                  borderColor: !isEraser && lineWidth === w ? 'var(--text-accent)' : 'rgba(255,255,255,0.15)',
                  background: 'var(--bg-surface)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{ width: w, height: w, borderRadius: '50%', background: '#fff' }} />
              </button>
            ))}
          </div>

          {/* Eraser */}
          <button
            onClick={() => setIsEraser(e => !e)}
            style={{
              padding: '5px 12px', borderRadius: 8, border: '2px solid',
              borderColor: isEraser ? 'var(--text-accent)' : 'rgba(255,255,255,0.15)',
              background: isEraser ? 'rgba(233,69,96,0.15)' : 'var(--bg-surface)',
              color: '#fff', cursor: 'pointer', fontSize: '0.82rem',
            }}
          >
            🧹 Eraser
          </button>

          {/* Clear */}
          <button
            onClick={handleClear}
            style={{
              padding: '5px 12px', borderRadius: 8, border: '2px solid rgba(255,255,255,0.15)',
              background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem',
            }}
          >
            🗑 Clear
          </button>
        </div>
      )}
    </div>
  );
}
