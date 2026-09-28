import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'pdfjs-dist/web/pdf_viewer.css';
import './lib/pdfWorker';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.tsx';
import { SettingsProvider } from './context/SettingsContext';
import { LibraryProvider } from './context/LibraryContext';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SettingsProvider>
      <LibraryProvider>
        <App />
      </LibraryProvider>
    </SettingsProvider>
  </BrowserRouter>,
);
