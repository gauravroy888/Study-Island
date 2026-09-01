import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SuperAdminErrorBoundary } from './components/SharedComponents.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SuperAdminErrorBoundary>
      <App />
    </SuperAdminErrorBoundary>
  </React.StrictMode>
);
