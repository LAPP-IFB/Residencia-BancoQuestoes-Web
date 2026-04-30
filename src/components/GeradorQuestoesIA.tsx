import { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Save, Loader2, CheckSquare } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface QuestaoGerada {
  id: string;
  enunciado: string;
  alternativas: string[];
  corretaIndex: number;
  dificuldade: string;
}

export function GeradorQuestoesIA() {
  const [tema, setTema] = useState('');
  const [dificuldade, setDificuldade] = useState('Médio');
  const [contexto, setContexto] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [questoesGeradas, setQuestoesGeradas] = useState<QuestaoGerada[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const handleGerarQuestoes = async () => {
    if (!tema) {
      toast.error("Por favor, preencha o tema da questão.");
      return;
    }

    setLoading(true);

    // AQUI ENTRARÁ O SEU FETCH REAL PARA A API NO FUTURO
    // Simulando um tempo de espera da IA (2 segundos)
    setTimeout(() => {
      const mockResultado: QuestaoGerada[] = [
        {
          id: `q-${Date.now()}-1`,
          enunciado: `Baseado no tema "${tema}" com foco em "${contexto || 'aspectos gerais'}", qual das alternativas abaixo está correta?`,
          alternativas: [
            "Alternativa A (Incorreta)",
            "Alternativa B (Correta)",
            "Alternativa C (Incorreta)",
            "Alternativa D (Incorreta)",
            "Alternativa E (Incorreta)"
          ],
          corretaIndex: 1,
          dificuldade: dificuldade
        },
        {
          id: `q-${Date.now()}-2`,
          enunciado: `Analise as afirmações sobre "${tema}" e marque a opção verdadeira.`,
          alternativas: ["Opção 1", "Opção 2", "Opção 3", "Opção 4 (Correta)", "Opção 5"],
          corretaIndex: 3,
          dificuldade: dificuldade
        }
      ];
      setQuestoesGeradas(mockResultado);
      setLoading(false);
      toast.success("Questões geradas com sucesso!");
    }, 2000);
  };

  const toggleSelecao = (id: string) => {
    const novasSelecionadas = new Set(selecionadas);
    if (novasSelecionadas.has(id)) {
      novasSelecionadas.delete(id);
    } else {
      novasSelecionadas.add(id);
    }
    setSelecionadas(novasSelecionadas);
  };

  const handleSalvarLote = () => {
    console.log("Salvando as seguintes questões:", Array.from(selecionadas));
    toast.success(`${selecionadas.size} questões salvas no banco de dados!`);
    
    // Limpa a tela após salvar
    setSelecionadas(new Set());
    setQuestoesGeradas([]);
    setTema('');
    setContexto('');
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
      {/* 1. ÁREA DE CONFIGURAÇÃO (O PROMPT) */}
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

        <div className="mt-6 flex justify-end">
          {/* CORREÇÃO DO BOTÃO: Usando a estrutura padrão e limpa */}
          <Button onClick={handleGerarQuestoes} disabled={loading} size="lg">
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            {loading ? 'Gerando com IA...' : 'Gerar Questões'}
          </Button>
        </div>
      </div>

      {/* 2. ÁREA DE RESULTADOS */}
      {questoesGeradas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <h3 className="text-xl font-bold text-gray-800">Resultados Gerados</h3>
            <span className="text-sm text-gray-500">{questoesGeradas.length} questões</span>
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
                      className="w-5 h-5 text-purple-600 rounded cursor-pointer"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold uppercase">Questão {index + 1}</span>
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-semibold uppercase">{q.dificuldade}</span>
                    </div>
                    
                    <p className="text-gray-800 font-medium text-lg leading-relaxed">{q.enunciado}</p>
                    
                    <div className="space-y-2 pl-4">
                      {q.alternativas.map((alt, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${idx === q.corretaIndex ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
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

      {/* 3. BARRA DE AÇÕES FLUTUANTE */}
      {selecionadas.size > 0 && (
        <motion.div 
          initial={{ y: 100 }} 
          animate={{ y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-6 z-50"
        >
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-purple-400" />
            <span className="font-medium">{selecionadas.size} {selecionadas.size === 1 ? 'selecionada' : 'selecionadas'}</span>
          </div>
          
          {/* CORREÇÃO DO BOTÃO INFERIOR */}
          <Button onClick={handleSalvarLote} variant="secondary" size="lg" className="rounded-full font-bold">
            <Save className="mr-2 w-4 h-4" />
            Salvar no Banco
          </Button>
        </motion.div>
      )}
    </div>
  );
}