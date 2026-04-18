import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { QuestionList } from './QuestionList';
import { LogOut, Plus, Settings } from 'lucide-react';
import { Question, Category, User } from '../types/question';
import { Logo } from './Logo';
import { toast } from 'sonner';

interface QuestionBankProps {
  user: User;
  onLogout: () => void;
}

// Mock initial data
const initialCategories: Category[] = [
  { id: '1', name: 'Matemática' },
  { id: '2', name: 'Português' },
  { id: '3', name: 'História' },
  { id: '4', name: 'Geografia' },
  { id: '5', name: 'Ciências' },
];

const initialQuestions: Question[] = [
  {
    id: 1,
    authorId: 1,
    authorName: 'Prof. João Silva',
    subject: 'Matemática',
    category: 'Matemática',
    tags: ['álgebra', 'equações'],
    statement: 'Qual o valor de x na equação: 2x + 5 = 15?',
    options: ['x = 3', 'x = 5', 'x = 7', 'x = 10', 'x = 15'],
    correctOption: 1,
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    authorId: 2,
    authorName: 'Prof. Maria Santos',
    subject: 'Português',
    category: 'Português',
    tags: ['gramática', 'verbos'],
    statement: 'Qual é o tempo verbal da frase: "Eu estudarei amanhã"?',
    options: [
      'Presente do indicativo',
      'Pretérito perfeito',
      'Futuro do presente',
      'Pretérito imperfeito',
      'Futuro do pretérito',
    ],
    correctOption: 2,
    createdAt: '2024-01-16T14:20:00Z',
  },
  {
    id: 3,
    authorId: 1,
    authorName: 'Prof. João Silva',
    subject: 'História',
    category: 'História',
    tags: ['brasil', 'independência'],
    statement: 'Em que ano ocorreu a Independência do Brasil?',
    options: ['1808', '1822', '1889', '1500', '1930'],
    correctOption: 1,
    createdAt: '2024-01-17T09:15:00Z',
  },
];

export function QuestionBank({ user, onLogout }: QuestionBankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Load data from API or use initial data
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch(
          'https://bancodequestoes-api.onrender.com/questions'
        );
        if (response.ok) {
          const questionsFromApi = await response.json();
          setQuestions(questionsFromApi);
          localStorage.setItem('questions', JSON.stringify(questionsFromApi));
        } else {
          // Fallback to localStorage or initial data
          const savedQuestions = localStorage.getItem('questions');
          if (savedQuestions) {
            setQuestions(JSON.parse(savedQuestions));
          } else {
            setQuestions(initialQuestions);
            localStorage.setItem('questions', JSON.stringify(initialQuestions));
          }
        }
      } catch (error) {
        console.error('Error fetching questions:', error);
        // Fallback to localStorage or initial data
        const savedQuestions = localStorage.getItem('questions');
        if (savedQuestions) {
          setQuestions(JSON.parse(savedQuestions));
        } else {
          setQuestions(initialQuestions);
          localStorage.setItem('questions', JSON.stringify(initialQuestions));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();

    // Load categories from subjects
    const savedSubjects = localStorage.getItem('subjects');
    const savedCategories = localStorage.getItem('categories');

    // Prioritize subjects from admin panel
    if (savedSubjects) {
      const subjects = JSON.parse(savedSubjects);
      const categoriesFromSubjects = subjects.map((s: any) => ({
        id: s.id,
        name: s.name,
      }));
      setCategories(categoriesFromSubjects);
      localStorage.setItem(
        'categories',
        JSON.stringify(categoriesFromSubjects)
      );
    } else if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    } else {
      setCategories(initialCategories);
      localStorage.setItem('categories', JSON.stringify(initialCategories));
    }
  }, []);

  const handleDeleteQuestion = (id: number) => {
    const updatedQuestions = questions.filter((q) => q.id !== id);
    setQuestions(updatedQuestions);
    localStorage.setItem('questions', JSON.stringify(updatedQuestions));
    toast.success('Questão excluída com sucesso!');
  };

  const handleImport = (importedQuestions: Pick<Question, 'statement' | 'options' | 'correctOption' | 'category' | 'tags'>[]) => {
    const existingIds = questions.map(q => q.id).filter(id => id !== undefined) as number[];
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newQuestions: Question[] = importedQuestions.map((q, index) => ({
      id: maxId + index + 1,
      authorId: user.id,
      authorName: user.name,
      subject: q.category, // Assuming category is used as subject
      category: q.category,
      tags: q.tags,
      statement: q.statement,
      options: q.options,
      correctOption: q.correctOption,
      createdAt: new Date().toISOString(),
    }));

    const updatedQuestions = [...questions, ...newQuestions];
    setQuestions(updatedQuestions);
    localStorage.setItem('questions', JSON.stringify(updatedQuestions));
    toast.success(`${newQuestions.length} questão(ões) importada(s) com sucesso!`);
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
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Logo size="sm" className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h1 className="truncate">Sistema de Questões</h1>
                <p className="text-gray-600 text-sm sm:text-base truncate">
                  Bem-vindo, {user.name}
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              {user.role === 'coordenador' && (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 sm:flex-none"
                >
                  <Button
                    variant="outline"
                    onClick={() => navigate('/admin')}
                    className="w-full sm:w-auto"
                  >
                    <Settings className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden xs:inline">Admin</span>
                    <span className="xs:hidden">Admin</span>
                  </Button>
                </motion.div>
              )}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 sm:flex-none"
              >
                <Button
                  onClick={() => navigate('/questoes/nova')}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">Nova Questão</span>
                  <span className="xs:hidden">Nova</span>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 sm:flex-none"
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
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="ml-2 text-gray-600">Carregando questões...</span>
          </div>
        ) : (
          <QuestionList
            questions={questions}
            onDeleteQuestion={handleDeleteQuestion}
            onImport={handleImport}
            onCreateNew={() => navigate('/questoes/nova')}
          />
        )}
      </main>
    </motion.div>
  );
}
