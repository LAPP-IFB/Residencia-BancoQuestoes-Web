import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { QuestionList } from './QuestionList';
import { LogOut, Plus, Settings, Sparkles } from 'lucide-react';
import { Question, Category, Subject, User } from '../types/question';
import { Logo } from './Logo';
import { toast } from 'sonner';

interface QuestionBankProps {
  user: User;
  onLogout: () => void;
}

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
    type: 'multiple_choice',
    statement: 'Qual o valor de x na equação: 2x + 5 = 15?',
    options: ['x = 3', 'x = 5', 'x = 7', 'x = 10', 'x = 15'],
    correctOption: 1,
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 2,
    authorId: 2,
    authorName: 'Prof. Maria Santos',
    subject: 'Ciências',
    category: 'Ciências',
    tags: ['biologia', 'células'],
    type: 'true_false',
    statement: 'A fotossíntese é o processo pelo qual as plantas produzem energia a partir da luz solar, água e gás carbônico.',
    options: [],
    correctOption: 0,
    correctAnswer: true,
    createdAt: '2024-01-18T11:00:00Z',
  },
  {
    id: 3,
    authorId: 1,
    authorName: 'Prof. João Silva',
    subject: 'História',
    category: 'História',
    tags: ['brasil', 'república'],
    type: 'essay',
    statement: 'Explique as principais causas que levaram à Proclamação da República no Brasil em 1889.',
    options: [],
    correctOption: 0,
    createdAt: '2024-01-19T08:30:00Z',
  },
];

export function QuestionBank({ user, onLogout }: QuestionBankProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ── Carregar dados ────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch('https://bancodequestoes-api.onrender.com/questions');
        if (response.ok) {
          const data = await response.json();
          setQuestions(data);
          localStorage.setItem('questions', JSON.stringify(data));
        } else {
          loadFromLocalStorage();
        }
      } catch (error) {
        console.error('Erro ao buscar questões:', error);
        loadFromLocalStorage();
      } finally {
        setLoading(false);
      }
    };

    const loadFromLocalStorage = () => {
      const saved = localStorage.getItem('questions');
      if (saved) {
        setQuestions(JSON.parse(saved));
      } else {
        setQuestions(initialQuestions);
        localStorage.setItem('questions', JSON.stringify(initialQuestions));
      }
    };

    fetchQuestions();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await fetch('https://bancodequestoes-api.onrender.com/subjects');
        if (response.ok) {
          const data: Subject[] = await response.json();
          setSubjects(data);
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
      }
    };

    fetchSubjects();
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDeleteQuestion = (id: number) => {
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);
    localStorage.setItem('questions', JSON.stringify(updated));
    toast.success('Questão excluída com sucesso!');
  };

 const handleImport = async (
  imported: Pick<
    Question,
    | 'statement'
    | 'options'
    | 'correctOption'
    | 'category'
    | 'tags'
    | 'type'
    | 'correctAnswer'
  >[]
) => {
  const importedCategories = [
    ...new Set(
      imported
        .map(q => q.category?.trim())
        .filter(Boolean)
    ),
  ];

  const existingSubjects = new Set(
    subjects.map(s => s.name.toLowerCase())
  );

  const createdSubjects: Subject[] = [];

  for (const category of importedCategories) {
    if (
      !existingSubjects.has(category.toLowerCase())
    ) {
      try {
        const response = await fetch(
          'https://bancodequestoes-api.onrender.com/subjects',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: category,
              createdAt: new Date().toISOString(),
            }),
          }
        );

        if (response.ok) {
          const subject = await response.json();

          createdSubjects.push(subject);
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  if (createdSubjects.length) {
    setSubjects(prev => [
      ...prev,
      ...createdSubjects,
    ]);

    setCategories(prev => [
      ...prev,
      ...createdSubjects.map(subject => ({
        id: String(subject.id),
        name: subject.name,
      })),
    ]);
  }

  const maxId =
    questions.length > 0
      ? Math.max(
          ...questions.map(q => q.id ?? 0)
        )
      : 0;

  const newQuestions: Question[] = imported.map(
    (q, index) => ({
      id: maxId + index + 1,
      authorId: user.id,
      authorName: user.name,

      subject: q.category,
      category: q.category,

      tags: q.tags ?? [],

      type: q.type ?? 'multiple_choice',

      statement: q.statement,

      options: q.options ?? [],

      correctOption:
        q.correctOption ?? 0,

      correctAnswer: q.correctAnswer,

      createdAt: new Date().toISOString(),
    })
  );

  const updated = [
    ...questions,
    ...newQuestions,
  ];

  setQuestions(updated);

  localStorage.setItem(
    'questions',
    JSON.stringify(updated)
  );

  toast.success(
    `${newQuestions.length} questão(ões) importada(s) com sucesso!`
  );
};

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:flex-none">
                  <Button variant="outline" onClick={() => navigate('/admin')} className="w-full sm:w-auto">
                    <Settings className="mr-1 sm:mr-2 h-4 w-4" />
                    Admin
                  </Button>
                </motion.div>
              )}

              {/* Botão IA — mantido como está no projeto atual */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:flex-none">
                <Button
                  onClick={() => navigate('/gerador-ia')}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">Gerar com IA</span>
                  <span className="xs:hidden">IA</span>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:flex-none">
                <Button onClick={() => navigate('/questoes/nova')} className="w-full sm:w-auto">
                  <Plus className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden xs:inline">Nova Questão</span>
                  <span className="xs:hidden">Nova</span>
                </Button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1 sm:flex-none">
                <Button variant="outline" onClick={handleLogoutClick} className="w-full sm:w-auto">
                  <LogOut className="mr-1 sm:mr-2 h-4 w-4" />
                  Sair
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
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