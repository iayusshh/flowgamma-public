import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminPage from './pages/AdminPage.jsx';
import './index.css';

const path = window.location.pathname || '/';
const isAdminRoute = path === '/admin' || path.startsWith('/admin/');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminPage /> : <App />}
  </React.StrictMode>
);
