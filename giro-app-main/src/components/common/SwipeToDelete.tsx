import { ReactNode, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}

const DELETE_WIDTH = 88;

export function SwipeToDelete({ children, onDelete, disabled }: SwipeToDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const handleStart = (clientX: number) => {
    if (disabled) return;
    startX.current = clientX;
    startOffset.current = offset;
    setDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!dragging) return;
    const delta = clientX - startX.current;
    const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffset.current + delta));
    setOffset(next);
  };

  const handleEnd = () => {
    if (!dragging) return;
    setDragging(false);
    setOffset(offset < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
          className="flex h-full items-center justify-center bg-red-500 text-white transition active:bg-red-600"
          style={{ width: DELETE_WIDTH }}
          aria-label="Excluir"
        >
          <Trash2 size={20} />
        </button>
      </div>
      <div
        className="relative bg-white touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseMove={(e) => handleMove(e.clientX)}
        onMouseUp={handleEnd}
        onMouseLeave={() => dragging && handleEnd()}
      >
        {children}
      </div>
    </div>
  );
}
