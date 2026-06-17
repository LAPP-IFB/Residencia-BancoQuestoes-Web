import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Save, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface QuestaoGerada {
  id: string | number;
  statement: string;
  options: string[];
  correctOption: number;
  subject: string;
  tags?: string[];
  authorName?: string;
}

export function GeradorQuestoesIA() {
  const navigate = useNavigate();
  
  const [tema, setTema] = useState('');
  const [dificuldade, setDificuldade] = useState('Médio');
  const [contexto, setContexto] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [questoesGeradas, setQuestoesGeradas] = useState<QuestaoGerada[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string | number>>(new Set());

  const handleGerarQuestoes = async () => {
    if (!tema) {
      toast.error("Por favor, preencha o tema da questão.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const mockResultado: QuestaoGerada[] = [
        {
          id: `q-${Date.now()}-1`,
          statement: `Baseado no tema "${tema}" com foco em "${contexto || 'aspectos gerais'}", qual das alternativas abaixo está correta?`,
          options: [
            "Alternativa A (Incorreta)",
            "Alternativa B (Correta)",
            "Alternativa C (Incorreta)",
            "Alternativa D (Incorreta)",
            "Alternativa E (Incorreta)"
          ],
          correctOption: 1,
          subject: "Língua Portuguesa",
          tags: ["Gramática", dificuldade]
        },
        {
          id: `q-${Date.now()}-2`,
          statement: `Analise as afirmações sobre "${tema}" e marque a opção verdadeira.`,
          options: ["Opção 1", "Opção 2", "Opção 3", "Opção 4 (Correta)", "Opção 5"],
          correctOption: 3,
          subject: "Língua Portuguesa",
          tags: ["Gramática", dificuldade]
        }
      ];
      setQuestoesGeradas(mockResultado);
      setLoading(false);
      toast.success("Questões geradas com sucesso!");
    }, 2000);
  };

  const toggleSelecao = (id: string | number) => {
    const novasSelecionadas = new Set(selecionadas);
    if (novasSelecionadas.has(id)) {
      novasSelecionadas.delete(id);
    } else {
      novasSelecionadas.add(id);
    }
    setSelecionadas(novasSelecionadas);
  };

  const handleSalvarLote = async () => {
    const questoesParaSalvar = questoesGeradas.filter(q => selecionadas.has(q.id));
    executarSalvamento(questoesParaSalvar);
  };

  const executarSalvamento = (questoes: QuestaoGerada[]) => {
    console.log("Enviando para a API (https://bancodequestoes-api.onrender.com/questions):", questoes);
    
    // AQUI ENTRA O FETCH REAL PARA A SUA API NO FUTURO
    
    toast.success(`${questoes.length} questão(ões) salva(s) com sucesso!`);
    
    setSelecionadas(new Set());
    setQuestoesGeradas([]);
    setTema('');
    setContexto('');

    // Voltar para a página inicial
    navigate('/'); 
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      
      {/* BOTÃO VOLTAR */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Página Inicial
        </Button>
      </div>

      {/* ÁREA DE CONFIGURAÇÃO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          Assistente de Geração por IA
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Tema da Questão *</label>
            <input 
              type="text" 
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex: Revolução Industrial, Função Quadrática..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Nível de Dificuldade</label>
            <select 
              value={dificuldade}
              onChange={(e) => setDificuldade(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
            >
              <option value="Fácil">Fácil</option>
              <option value="Médio">Médio</option>
              <option value="Difícil">Difícil</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-semibold text-gray-700">Contexto ou Instruções Adicionais</label>
            <textarea 
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              placeholder="Ex: Focar nas consequências econômicas. Não citar o ano exato."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none h-24 resize-none"
            />
          </div>
        </div>

        {/* BOTÕES: SALVAR E GERAR (Lado a lado) */}
        <div className="mt-6 flex flex-wrap justify-end gap-4">
          <Button 
            onClick={handleSalvarLote} 
            disabled={selecionadas.size === 0} 
            size="lg"
            variant="outline"
            className={selecionadas.size > 0 ? "bg-green-600 hover:bg-green-700 text-black border-none" : ""}
          >
            <Save className="mr-2 h-5 w-5" />
            Salvar ({selecionadas.size}) e Voltar
          </Button>

          <Button onClick={handleGerarQuestoes} disabled={loading} size="lg">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            {loading ? 'Gerando com IA...' : 'Gerar Questões'}
          </Button>
        </div>
      </div>

      {/* ÁREA DE RESULTADOS */}
      {questoesGeradas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Resultados Gerados</h3>
              <span className="text-sm text-gray-500">Marque as caixinhas abaixo e depois clique no botão "Salvar" lá em cima.</span>
            </div>
          </div>

          <div className="grid gap-6">
            {questoesGeradas.map((q, index) => (
              <div 
                key={q.id} 
                className={`p-6 rounded-xl border-2 transition-all ${selecionadas.has(q.id) ? 'border-purple-500 bg-purple-50/30' : 'border-gray-200 bg-white hover:border-purple-300'}`}
              >
                <div className="flex gap-4 items-start">
                  <div className="pt-1">
                    <input 
                      type="checkbox" 
                      checked={selecionadas.has(q.id)}
                      onChange={() => toggleSelecao(q.id)}
                      className="w-6 h-6 text-purple-600 rounded cursor-pointer"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold uppercase">Questão {index + 1}</span>
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold uppercase">{q.subject}</span>
                    </div>
                    
                    <p className="text-gray-800 font-medium text-lg leading-relaxed">{q.statement}</p>
                    
                    <div className="space-y-2 pl-4">
                      {q.options.map((alt, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${idx === q.correctOption ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                          <span className="mr-3 font-bold">{String.fromCharCode(65 + idx)}.</span>
                          {alt}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}