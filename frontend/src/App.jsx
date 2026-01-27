import './App.css';
import { AuthProvider } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './hooks/useAuth';

function AppInner() {
  const { user } = useAuth();
  if (!user) {
    return <LoginPage />;
  }
  return <Dashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
