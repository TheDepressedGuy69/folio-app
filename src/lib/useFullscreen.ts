import { useCallback, useEffect, useState, type RefObject } from 'react';

export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  const toggle = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (ref.current) {
      await ref.current.requestFullscreen().catch(() => {
        // Fullscreen can be denied (e.g. no user gesture, or unsupported) — fail quietly.
      });
    }
  }, [ref]);

  return { isFullscreen, toggle };
}
