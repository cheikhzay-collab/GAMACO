// src/pages/AuthCallback.jsx
// Legacy OAuth callback route — redirects cleanly to /login or /dashboard in standalone MySQL mode.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    navigate(token ? '/dashboard' : '/login', { replace: true });
  }, [navigate]);

  return null;
}
