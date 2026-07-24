import Modal from '../shared/Modal';
import { useUiStore } from '../../store/uiStore';
import socket from '../../socket';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const BG = {
  red: 'var(--color-red)',
  blue: 'var(--color-blue)',
  green: 'var(--color-green)',
  yellow: 'var(--color-yellow)',
};

export default function ColorPicker() {
  const { showColorPicker, closeColorPicker } = useUiStore();
  if (!showColorPicker) return null;

  const pick = (color) => {
    socket.emit('game:choose_color', { color });
    closeColorPicker();
  };

  return (
    <Modal title="Choose a Color">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => pick(c)}
            style={{
              height: 64, borderRadius: 10, background: BG[c],
              color: c === 'yellow' ? '#333' : '#fff',
              fontWeight: 800, fontSize: '1rem', textTransform: 'capitalize',
              border: 'none', cursor: 'pointer',
              transition: 'transform 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {c}
          </button>
        ))}
      </div>
    </Modal>
  );
}
