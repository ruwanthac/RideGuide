import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getStoredToken } from '../lib/api';

export function RequireAuth() {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  useEffect(() => {
    const sync = () => setToken(getStoredToken());
    window.addEventListener('rideguide:auth', sync);
    return () => window.removeEventListener('rideguide:auth', sync);
  }, []);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
