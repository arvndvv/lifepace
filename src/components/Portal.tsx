import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

export function Portal({ children }: PortalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (!containerRef.current) {
    containerRef.current = document.createElement('div');
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    document.body.appendChild(container);
    return () => {
      document.body.removeChild(container);
    };
  }, []);

  if (!containerRef.current) {
    return null;
  }

  return createPortal(children, containerRef.current);
}
