import { useEffect, useRef } from 'react';

/**
 * Faz o botão de voltar do celular fechar este modal/tela em vez de sair do app.
 *
 * Como funciona: quando o modal abre, empilhamos um estado no histórico do
 * navegador. Se o usuário apertar "voltar", o navegador dispara o evento
 * "popstate" — a gente escuta esse evento e chama onClose() em vez de deixar
 * o navegador voltar de verdade (o que fecharia o app, por falta de histórico).
 *
 * Se o modal for fechado pelo próprio app (botão "Cancelar", salvar, clicar
 * fora), removemos o estado que empilhamos, pra não sobrar um "voltar
 * fantasma" no histórico.
 *
 * Uso:
 *   useModalBackButton(isModalOpen, () => setIsModalOpen(false));
 */
export function useModalBackButton(isOpen: boolean, onClose: () => void) {
  const wasOpenRef = useRef(false);
  const closingByBackRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      window.history.pushState({ modal: true }, '');
      wasOpenRef.current = true;
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      if (!closingByBackRef.current) {
        // Fechado pelo app (não pelo botão voltar): remove o estado empilhado
        window.history.back();
      }
      closingByBackRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (wasOpenRef.current) {
        closingByBackRef.current = true;
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);
}
