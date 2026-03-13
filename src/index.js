if (typeof window !== 'undefined' && !window.process) {
  window.process = { env: {}, nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0) };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
