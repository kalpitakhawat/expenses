import { Navigate, Route, Routes } from 'react-router-dom';
import { AppFrame } from './components/Shell';
import { DashboardPage } from './pages/Dashboard';
import { EventPage } from './pages/EventPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { useStore } from './store';

function RequireReady() {
  const { phase } = useStore();
  if (phase === 'setup') return <Navigate to="/setup" replace />;
  return <AppFrame />;
}

export function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route element={<RequireReady />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/events/:id" element={<EventPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
