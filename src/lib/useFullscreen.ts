import { useCallback, useEffect, useState, type RefObject } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './db';

/**
 * In the desktop app this fullscreens the native window itself (no browser
 * "press Esc to exit" overlay); in a plain browser tab it falls back to the
 * DOM Fullscreen API.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isTauri) {
      const win = getCurrentWindow();
      const sync = () => win.isFullscreen().then(setIsFullscreen).catch(() => {});
      sync();
      const unlisten = win.onResized(sync);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') win.isFullscreen().then((f) => { if (f) void win.setFullscreen(false); }).catch(() => {});
      };
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        unlisten.then((fn) => fn()).catch(() => {});
        // Never leave the window stuck fullscreen when leaving the reader.
        win.setFullscreen(false).catch(() => {});
      };
    }
    const onChange = () => setIsFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);

  const toggle = useCallback(async () => {
    if (isTauri) {
      const win = getCurrentWindow();
      const next = !(await win.isFullscreen());
      await win.setFullscreen(next);
      setIsFullscreen(next);
      return;
    }
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
