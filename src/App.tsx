import { useEffect, useState } from 'react';
import { useRoute } from './lib/router';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Players } from './screens/Players';
import { Result } from './screens/Result';
import { Score } from './screens/Score';
import { Setup } from './screens/Setup';

const THEME_KEY = 'pa.theme';

function readTheme(): 'dark' | 'light' {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

const TITLES: Record<string, string> = {
  setup: 'Neues Spiel',
  score: 'Punkte',
  result: 'Auswertung',
  history: 'Partien',
  players: 'Spieler & Statistiken',
};

export function App() {
  const [section, id] = useRoute();
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4ede2' : '#1b1612');
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  // The play screen uses the whole display.
  if (section === 'play' && id) return <Play key={id} id={id} />;

  let page;
  switch (section) {
    case 'setup': page = <Setup />; break;
    case 'score': page = id ? <Score key={id} id={id} /> : null; break;
    case 'result': page = id ? <Result key={id} id={id} /> : null; break;
    case 'history': page = <History />; break;
    case 'players': page = <Players />; break;
    default: page = <Home />;
  }

  return (
    <div className="app">
      <header className="topbar">
        {section && <a href="#/" aria-label="Zur Startseite" style={{ fontSize: 22 }}>⌂</a>}
        <h1>{section ? TITLES[section] ?? 'ParalysisAnalyse' : 'ParalysisAnalyse'}</h1>
        <button className="ghost icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Hell/Dunkel umschalten">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>
      {page}
    </div>
  );
}
