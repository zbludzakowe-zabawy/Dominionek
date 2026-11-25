// Łapacz błędów: zamiast pustego (szarego) ekranu pokazuje, co się stało, i pozwala wrócić do gry.
import { Component, type ReactNode } from 'react';
import { tr } from '../i18n';
import { loadSettings } from './store';

interface State {
  error: Error | null;
  /** Zmienia się przy „Wróć do gry” – dzieci rysują się od nowa (gra odtwarza się z zapisu). */
  round: number;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, round: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error('Crownforge:', error, info.componentStack);
  }

  render() {
    const { error, round } = this.state;
    if (!error) return <div key={round} style={{ display: 'contents' }}>{this.props.children}</div>;
    const lang = loadSettings().lang;
    const t = (k: string) => tr(lang, k);
    const where = (error.stack ?? '').split('\n').slice(0, 4).join('\n');
    return (
      <div className="screen">
        <main className="page crash">
          <h1>{t('crash.title')}</h1>
          <p className="muted">{t('crash.info')}</p>
          <pre className="crash-text">
            {String(error.message || error)}
            {where ? '\n\n' + where : ''}
          </pre>
          <div className="row-buttons">
            <button className="btn primary" onClick={() => this.setState({ error: null, round: round + 1 })}>
              {t('crash.back')}
            </button>
            <button className="btn" onClick={() => location.reload()}>
              {t('crash.reload')}
            </button>
          </div>
        </main>
      </div>
    );
  }
}
