import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { initPwa } from './pwa';
import './styles.css';

// Bez automatycznego tłumaczenia przeglądarki (Chrome/Google Tłumacz): podmienia teksty na stronie,
// przez co React się wywraca (szary ekran), a imiona graczy są „tłumaczone” („Do” → „Rób”).
// Atrybut ustawiany także tutaj, bo podgląd (Artifact) nie ma naszego <html>.
document.documentElement.setAttribute('translate', 'no');
document.documentElement.classList.add('notranslate');
document.getElementById('root')!.setAttribute('translate', 'no');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
initPwa();
