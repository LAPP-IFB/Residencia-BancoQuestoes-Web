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

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    // 1. Verifica usuários registrados localmente primeiro
    const registeredUsers = JSON.parse(
      localStorage.getItem('registeredUsers') || '[]'
    );
    const localUser = registeredUsers.find((u: any) => u.email === email);

    if (localUser) {
      if (localUser.password !== password) {
        throw new Error('E-mail ou senha inválidos.');
      }
      const loggedUser = { ...localUser };
      setUser(loggedUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedUser));
      return;
    }

    // 2. Se não encontrar localmente, tenta a API real via POST
    try {
      const response = await fetch(
        '/api/login/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // A API usa "username" e "password" (padrão Django JWT — confirmado na doc)
          body: JSON.stringify({ username: email, password: password }),
        }
      );

      if (!response.ok) {
        throw new Error('E-mail ou senha inválidos no servidor.');
      }

      const data = await response.json();
      // O login retorna { access, refresh } — salva o token para usar nas próximas requisições
      if (data.access) {
        localStorage.setItem('authToken', data.access);
      }

      const loggedUser: User = {
        id: Date.now(), // A API de login não retorna id do usuário, usamos fallback
        name: email,   // Idem para o nome — pode ser atualizado depois com GET /api/usuarios/
        email: email,
        role: 'professor', // Padrão; coordenador é identificado após buscar perfil
      };

      setUser(loggedUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedUser));

    } catch (error) {
      throw new Error('Usuário não encontrado ou credenciais inválidas.');
    }
  };

  const handleRegister = (
    name: string,
    email: string,
    password: string
  ): boolean => {
    const registeredUsers = JSON.parse(
      localStorage.getItem('registeredUsers') || '[]'
    );

    if (
      email === 'coordenador@escola.com' ||
      email === 'professor@escola.com' ||
      registeredUsers.some((u: any) => u.email === email)
    ) {
      return false;
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
      role: 'professor' as const,
      createdAt: new Date().toISOString(),
    };

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