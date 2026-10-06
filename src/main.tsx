import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AiStateProvider } from './state/AiState';
import { AppStateProvider } from './state/AppState';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppStateProvider>
      <AiStateProvider>
        <App />
      </AiStateProvider>
    </AppStateProvider>
  </StrictMode>,
);
