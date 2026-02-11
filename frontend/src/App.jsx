// ===========================================
// App.jsx - Main Application Entry
// ===========================================
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/shared/Toast';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
