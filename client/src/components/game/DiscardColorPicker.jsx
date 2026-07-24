import Modal from '../shared/Modal';
import { useUiStore } from '../../store/uiStore';
import socket from '../../socket';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const BG = {
  red: 'var(--color-red)', blue: 'var(--color-blue)',
  green: 'var(--color-green)', yellow: 'var(--color-yellow)',
};

export default function DiscardColorPicker() {
  const { showDiscardColor, closeDiscardColor } = useUiStore();
  if (!showDiscardColor) return null;

  const pick = (color) => {
    socket.emit('game:choose_discard_color', { color });
    closeDiscardColor();
  };

  return (
    <Modal title="Discard All Cards of Color…">
      <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: '0.88rem' }}>
        The next player will discard all cards of the chosen color.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => pick(c)} style={{
            height: 56, borderRadius: 10, background: BG[c],
            color: c === 'yellow' ? '#333' : '#fff',
            fontWeight: 800, fontSize: '0.95rem', textTransform: 'capitalize',
            border: 'none', cursor: 'pointer',
          }}>
            {c}
          </button>
        ))}
      </div>
    </Modal>
  );
}
