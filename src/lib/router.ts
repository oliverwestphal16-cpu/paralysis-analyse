import { useEffect, useState } from 'react';

/** Minimal hash router: "#/result/abc" → ["result", "abc"]. Hash routing works on GitHub Pages without rewrites. */
export function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string, replace = false): void {
  const hash = `#/${path.replace(/^\//, '')}`;
  if (replace) window.location.replace(hash);
  else window.location.hash = hash;
}
