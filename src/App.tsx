import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LoginScreen } from './components/LoginScreen';
import { QuestionBank } from './components/QuestionBank';
import { NewQuestionPage } from './components/NewQuestionPage';
import { EditQuestionPage } from './components/EditQuestionPage';
import { AdminPanel } from './components/AdminPanel';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import { User } from './types/question';
import { RegisterScreen } from './components/RegisterScreen';

// Mock user authentication
function AnimatedRoutes({
  user,
  handleLogin,
  handleRegister,
  handleLogout,
}: {
  user: User | null;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleRegister: (name: string, email: string, password: string) => boolean;
  handleLogout: () => void;
}) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/cadastro"
          element={user ? <Navigate to="/" replace /> : <RegisterScreen />}
        />

        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <LoginScreen onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute user={user}>
              <QuestionBank user={user!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/questoes/nova"
          element={
            <ProtectedRoute user={user}>
              <NewQuestionPage user={user!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/questoes/:id/editar"
          element={
            <ProtectedRoute user={user}>
              <EditQuestionPage user={user!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} requireRole="coordenador">
              <AdminPanel user={user!} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in (from localStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    // Primeiro, verifica usuários registrados localmente
    const registeredUsers = JSON.parse(
      localStorage.getItem('registeredUsers') || '[]'
    );
    const localUser = registeredUsers.find((u: any) => u.email === email);

    if (localUser) {
      // Valida a senha para usuários locais
      if (localUser.password !== password) {
        throw new Error('E-mail ou senha inválidos.');
      }
      const loggedUser = { ...localUser };
      setUser(loggedUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedUser));
      return;
    }

    // Se não encontrar localmente, tenta a API (para contas de teste)
    try {
      const response = await fetch(
        `https://bancodequestoes-api.onrender.com/users?email=${email}`
      );
      if (!response.ok) {
        throw new Error('Falha ao conectar com o servidor.');
      }
      const users: User[] = await response.json();
      const apiUser = users[0]; // Pega o primeiro usuário que corresponde ao email

      if (apiUser) {
        const loggedUser = { ...apiUser };
        setUser(loggedUser);
        localStorage.setItem('currentUser', JSON.stringify(loggedUser));
      } else {
        throw new Error('Usuário não encontrado.');
      }
    } catch (error) {
      throw new Error('Usuário não encontrado.');
    }
  };

  const handleRegister = (
    name: string,
    email: string,
    password: string
  ): boolean => {
    // Check if email already exists
    const registeredUsers = JSON.parse(
      localStorage.getItem('registeredUsers') || '[]'
    );

    // Check for duplicate email (including test accounts)
    if (
      email === 'coordenador@escola.com' ||
      email === 'professor@escola.com' ||
      registeredUsers.some((u: any) => u.email === email)
    ) {
      return false;
    }

    // Create new user
    const newUser = {
      id: Date.now(),
      name,
      email,
      password, // In production, this should be hashed
      role: 'professor' as const, // New registrations are always professors
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage
    registeredUsers.push(newUser);
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

    return true;
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster />
      <AnimatedRoutes
        user={user}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
        handleRegister={handleRegister}
      />
    </BrowserRouter>
  );
}
