import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { RequireAuth } from './components/RequireAuth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Vehicles } from './pages/Vehicles';
import { Diagnoses } from './pages/Diagnoses';
import { Requests } from './pages/Requests';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { AuditLogs } from './pages/AuditLogs';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="diagnoses" element={<Diagnoses />} />
            <Route path="requests" element={<Requests />} />
            <Route path="requests/tow" element={<Requests />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
