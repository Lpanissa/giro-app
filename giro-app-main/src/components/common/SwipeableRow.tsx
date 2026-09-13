import React, { useState, useRef } from 'react';
import { Trash2, Edit2 } from 'lucide-react';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit: () => void;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({ children, onDelete, onEdit }) => {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const MAX_SWIPE = 100; // Limite de pixels para o arraste

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    startXRef.current = clientX;
    startYRef.current = clientY;
    isHorizontalSwipeRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSwiping) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const diffX = clientX - startXRef.current;
    const diffY = clientY - startYRef.current;

    // Detecta se o movimento inicial é horizontal ou vertical para evitar conflitos
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 5) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 5) {
        isHorizontalSwipeRef.current = false;
        setIsSwiping(false);
        return;
      }
    }

    if (isHorizontalSwipeRef.current) {
      // Trava o comportamento padrão para evitar o scroll da tela enquanto arrasta para o lado
      if (e.cancelable) e.preventDefault();

      // Limita o arraste entre -MAX_SWIPE e +MAX_SWIPE
      if (diffX > 0) {
        setOffset(Math.min(diffX, MAX_SWIPE)); // Arraste para a direita (Editar)
      } else {
        setOffset(Math.max(diffX, -MAX_SWIPE)); // Arraste para a esquerda (Excluir)
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);

    if (offset > 70) {
      onEdit(); // Passou do limite para a direita -> Edita
    } else if (offset < -70) {
      onDelete(); // Passou do limite para a esquerda -> Exclui
    }

    // Retorna a linha para a posição original com animação
    setOffset(0);
    isHorizontalSwipeRef.current = null;
  };

  return (
    <div className="relative overflow-hidden my-2 rounded-xl select-none">
      {/* Fundo com as ações reveladas */}
      <div className="absolute inset-0 flex items-center justify-between px-6 rounded-xl text-white font-semibold">
        {/* Lado esquerdo (Revelado ao arrastar para a direita) -> EDITAR (AZUL) */}
        <div className={`absolute inset-y-0 left-0 w-1/2 bg-blue-600 flex items-center pl-6 transition-opacity duration-200 ${offset > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-2">
            <Edit2 size={20} />
            <span className="text-sm">Editar</span>
          </div>
        </div>

        {/* Lado direito (Revelado ao arrastar para a esquerda) -> EXCLUIR (VERMELHO) */}
        <div className={`absolute inset-y-0 right-0 w-1/2 bg-red-600 flex items-center justify-end pr-6 transition-opacity duration-200 ${offset < 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">Excluir</span>
            <Trash2 size={20} />
          </div>
        </div>
      </div>

      {/* Conteúdo principal do card (Arrastável) */}
      <div
        className="relative bg-white dark:bg-gray-800 transition-transform duration-150 ease-out cursor-grab active:cursor-grabbing"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
