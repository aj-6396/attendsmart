import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import UpdatePrompt from './components/UpdatePrompt.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UpdatePrompt />
    <App />
  </StrictMode>,
);
