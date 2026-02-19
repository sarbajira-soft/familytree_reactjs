import { useCallback, useState } from 'react';

/** BLOCK OVERRIDE: Shared modal state hook for block confirmation dialogs. */
export const useBlockModal = () => {
  const [isVisible, setIsVisible] = useState(false);

  const openModal = useCallback(() => {
    setIsVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsVisible(false);
  }, []);

  return {
    isVisible,
    openModal,
    closeModal,
  };
};
