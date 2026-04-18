import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { QuestionForm } from './QuestionForm';
import { LogOut, ArrowLeft } from 'lucide-react';
import { Question, Subject, User } from '../types/question';
import { Logo } from './Logo';
import { toast } from 'sonner';

interface NewQuestionPageProps {
  user: User;
  onLogout: () => void;
}

export function NewQuestionPage({ user, onLogout }: NewQuestionPageProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const navigate = useNavigate();

  // Load subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch(
          'https://bancodequestoes-api.onrender.com/subjects'
        );
        if (!response.ok) {
          throw new Error('Erro ao carregar disciplinas');
        }
        const data: Subject[] = await response.json();
        setSubjects(data);
      } catch (error) {
        toast.error((error as Error).message);
      }
    };

    fetchSubjects();
  }, []);

  const handleAddQuestion = (question: Question) => {
    // Load existing questions
    const savedQuestions = localStorage.getItem('questions');
    const questions = savedQuestions ? JSON.parse(savedQuestions) : [];

    // Add new question
    const updatedQuestions = [...questions, question];
    localStorage.setItem('questions', JSON.stringify(updatedQuestions));

    // Show success message
    toast.success('Questão cadastrada com sucesso!');

    // Navigate back to question list
    navigate('/');
  };

  const handleAddSubject = async (subjectName: string): Promise<Subject | null> => {
    if (!subjectName.trim()) {
      toast.error('Preencha o nome da disciplina');
      return null;
    }

    try {
      const response = await fetch(
        'https://bancodequestoes-api.onrender.com/subjects',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: subjectName,
            createdAt: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao adicionar disciplina');
      }

      const newSubject: Subject = await response.json();

      const updatedSubjects = [...subjects, newSubject];
      setSubjects(updatedSubjects);

      toast.success(`Disciplina ${newSubject.name} adicionada com sucesso`);
      return newSubject;
    } catch (error) {
      toast.error((error as Error).message);
      return null;
    }
  };

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-green-50 via-white to-red-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.header
        className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Voltar</span>
                </Button>
              </motion.div>
              <Logo size="sm" className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="truncate">Nova Questão</h1>
                <p className="text-gray-600 text-sm sm:text-base hidden sm:block">
                  Cadastre uma nova questão
                </p>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                onClick={handleLogoutClick}
                className="w-full sm:w-auto"
              >
                <LogOut className="mr-1 sm:mr-2 h-4 w-4" />
                Sair
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <motion.div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <QuestionForm
            subjects={subjects}
            onSubmit={handleAddQuestion}
            onAddSubject={handleAddSubject}
            onCancel={() => navigate('/')}
            user={user}
          />
        </motion.div>
      </main>
    </motion.div>
  );
}
