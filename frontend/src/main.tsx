import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WalletProvider>
  </React.StrictMode>,
);