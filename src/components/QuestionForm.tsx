import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Question, Subject, User, QuestionType, getQuestionType } from '../types/question';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import {
  X, Plus, Image as ImageIcon, Link2, Upload, Trash2,
  ListChecks, ToggleLeft, PenLine,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Resizable } from 're-resizable';

interface ImageState {
  src: string;
  width: number;
  height: number;
}

interface QuestionFormProps {
  subjects: Subject[];
  onSubmit: (question: Question) => void;
  onAddSubject: (name: string) => Promise<Subject | null>;
  onCancel: () => void;
  initialQuestion?: Question;
  isEditing?: boolean;
  user: User;
}

const QUESTION_TYPES: {
  type: QuestionType;
  label: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  { type: 'multiple_choice', label: 'Múltipla Escolha', desc: '5 alternativas, 1 correta', icon: ListChecks },
  { type: 'true_false',      label: 'Verdadeiro/Falso', desc: 'Afirmação V ou F',          icon: ToggleLeft },
  { type: 'essay',           label: 'Questão Aberta',   desc: 'Resposta dissertativa',      icon: PenLine },
];

export function QuestionForm({
  subjects, onSubmit, onAddSubject, onCancel, initialQuestion, isEditing, user,
}: QuestionFormProps) {
  const [questionType, setQuestionType] = useState<QuestionType>(
    initialQuestion ? getQuestionType(initialQuestion) : 'multiple_choice'
  );
  const [subject, setSubject] = useState(initialQuestion?.subject || '');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [tags, setTags] = useState<string[]>(initialQuestion?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [statement, setStatement] = useState(initialQuestion?.statement || '');
  const [options, setOptions] = useState(
    initialQuestion?.options?.length
      ? [...initialQuestion.options, ...Array(5).fill('')].slice(0, 5)
      : ['', '', '', '', '']
  );
  const [correctOption, setCorrectOption] = useState<number>(
    initialQuestion?.correctOption ?? 0
  );
  const [correctAnswer, setCorrectAnswer] = useState<boolean>(
    initialQuestion?.correctAnswer ?? true
  );

  // Imagem
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [images, setImages] = useState<ImageState[]>([]);

  // ── Efeitos ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(statement, 'text/html');
    const imgEls = doc.querySelectorAll('img');
    const extracted: ImageState[] = Array.from(imgEls).map((img) => {
      const style = img.getAttribute('style') || '';
      const w = style.match(/width:\s*(\d+)px/)?.[1];
      const h = style.match(/height:\s*(\d+)px/)?.[1];
      return { src: img.src, width: w ? +w : 300, height: h ? +h : 200 };
    });
    if (JSON.stringify(extracted) !== JSON.stringify(images)) setImages(extracted);
  }, [statement]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.inline-block.relative')) {
        setSelectedImageIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('https://bancodequestoes-api.onrender.com/tags');
        if (response.ok) {
          const tagsData = await response.json();
          setAvailableTags(tagsData.map((t: any) => t.name || t));
        }
      } catch (error) {
        console.error('Erro ao buscar tags:', error);
      }
    };
    fetchTags();
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const handleAddAvailableTag = (tag: string) => {
    if (!tags.includes(tag)) setTags([...tags, tag]);
  };

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handleCreateSubject = async () => {
    if (newSubjectName.trim()) {
      const newSubject = await onAddSubject(newSubjectName.trim());
      if (newSubject) {
        setSubject(newSubject.name);
        setNewSubjectName('');
      }
    }
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
    const textarea = document.getElementById('statement') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = statement.substring(start, end);
    if (!selected) return;
    const tagMap: Record<string, string[]> = {
      bold: ['<strong>', '</strong>'],
      italic: ['<em>', '</em>'],
      underline: ['<u>', '</u>'],
    };
    const [open, close] = tagMap[format];
    setStatement(statement.substring(0, start) + open + selected + close + statement.substring(end));
  };

  // ── Imagens ──────────────────────────────────────────────────────────────

  const getDisplayStatement = () =>
    statement.replace(/<img[^>]*>/gi, '').replace(/<br>/gi, '\n');

  const handleInsertImageUrl = () => {
    if (imageUrl.trim()) {
      setStatement(
        statement + `<br><img src="${imageUrl.trim()}" alt="Imagem" style="width: 300px; height: 200px;" /><br>`
      );
      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione apenas imagens.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('A imagem deve ter no máximo 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setStatement(statement + `<br><img src="${base64}" alt="${file.name}" style="width: 300px; height: 200px;" /><br>`);
      setShowImageDialog(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const updateImageInStatement = (index: number, width: number, height: number) => {
    const doc = new DOMParser().parseFromString(statement, 'text/html');
    const imgs = doc.querySelectorAll('img');
    if (imgs[index]) {
      imgs[index].setAttribute('style', `width: ${width}px; height: ${height}px;`);
      setStatement(doc.body.innerHTML);
    }
  };

  const handleDeleteImage = (index: number) => {
    const doc = new DOMParser().parseFromString(statement, 'text/html');
    const imgs = doc.querySelectorAll('img');
    if (imgs[index]) {
      imgs[index].previousSibling?.nodeName === 'BR' && imgs[index].previousSibling?.remove();
      imgs[index].nextSibling?.nodeName === 'BR' && imgs[index].nextSibling?.remove();
      imgs[index].remove();
      setStatement(doc.body.innerHTML);
      setSelectedImageIndex(null);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !statement.trim()) {
      alert('Por favor, preencha a disciplina e o enunciado.');
      return;
    }
    if (questionType === 'multiple_choice' && options.some((o) => !o.trim())) {
      alert('Preencha todas as 5 alternativas.');
      return;
    }

    const data: Omit<Question, 'id'> = {
      type: questionType,
      subject,
      category: subject, // mantém os dois campos sincronizados
      tags,
      statement,
      options: questionType === 'multiple_choice' ? options : [],
      correctOption: questionType === 'multiple_choice' ? correctOption : 0,
      correctAnswer: questionType === 'true_false' ? correctAnswer : undefined,
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch('https://bancodequestoes-api.onrender.com/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao salvar questão');
      const savedQuestion = await response.json();
      onSubmit(savedQuestion);
      onCancel();
    } catch (error) {
      alert(`Erro: ${(error as Error).message}`);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Dialog de Imagem */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="w-full max-w-[500px] max-h-[90vh] overflow-auto p-6">
          <DialogHeader>
            <DialogTitle>Inserir Imagem</DialogTitle>
            <DialogDescription>Upload ou link externo</DialogDescription>
          </DialogHeader>

          <div className="flex w-full p-1 bg-gray-100 rounded-lg mb-4 relative">
            {(['upload', 'url'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 relative flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors z-10 rounded-md outline-none ${
                  activeTab === tab ? 'text-black' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="imgTabBg"
                    className="absolute inset-0 bg-white rounded-md shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-20 flex items-center gap-2">
                  {tab === 'upload' ? <Upload className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  {tab === 'upload' ? 'Upload' : 'Link'}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'upload' ? (
              <motion.div key="upload" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-3">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Escolher Arquivo
                </Button>
                <p className="text-xs text-gray-500 text-center">JPG, PNG, GIF, SVG — máx. 5MB</p>
              </motion.div>
            ) : (
              <motion.div key="url" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="space-y-3">
                <Label htmlFor="image-url">URL da imagem</Label>
                <Input
                  id="image-url"
                  type="url"
                  placeholder="https://exemplo.com/imagem.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInsertImageUrl(); } }}
                />
                <Button type="button" className="w-full" onClick={handleInsertImageUrl} disabled={!imageUrl.trim()}>
                  Inserir Imagem
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">

        {/* 1. Tipo de Questão */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Label>Tipo de Questão *</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {QUESTION_TYPES.map(({ type, label, desc, icon: Icon }) => {
              const active = questionType === type;
              return (
                <motion.button
                  key={type}
                  type="button"
                  onClick={() => setQuestionType(type)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative rounded-lg border-2 p-3 text-left transition-all outline-none cursor-pointer ${
                    active ? 'border-gray-700 bg-gray-50' : 'border-gray-200 hover:border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  <Icon className={`h-5 w-5 mb-1.5 ${active ? 'text-gray-700' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-600'}`}>{label}</p>
                  <p className={`text-xs ${active ? 'text-gray-500' : 'text-gray-400'}`}>{desc}</p>
                  {active && (
                    <motion.div layoutId="typeIndicator" className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gray-700" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* 2. Disciplina */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Label htmlFor="subject">Disciplina *</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione uma disciplina" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((sub) => (
                <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="Nova disciplina"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={handleCreateSubject} className="flex-shrink-0">
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Criar</span>
            </Button>
          </div>
        </motion.div>

        {/* 3. Tags */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Label htmlFor="tags">Tags / Palavras-chave</Label>
          <div className="flex gap-2">
            <Input
              id="tags"
              placeholder="Digite uma tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={handleAddTag} className="flex-shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <AnimatePresence>
            {tags.length > 0 && (
              <motion.div className="flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {tags.map((tag) => (
                  <Badge key={tag} className="gap-1">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveTag(tag)} />
                  </Badge>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {availableTags.length > 0 && (
            <div className="mt-2">
              <Label className="text-sm text-gray-600 mb-2 block">Tags disponíveis:</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={tags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/20"
                    onClick={() => handleAddAvailableTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* 4. Enunciado */}
        <motion.div className="space-y-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Label htmlFor="statement">Enunciado *</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(['bold', 'italic', 'underline'] as const).map((fmt) => (
              <Button key={fmt} type="button" size="sm" variant="outline" onClick={() => applyFormatting(fmt)}>
                <span className="hidden sm:inline">{{ bold: 'Negrito', italic: 'Itálico', underline: 'Sublinhado' }[fmt]}</span>
                <span className="sm:hidden">{{ bold: 'N', italic: 'I', underline: 'S' }[fmt]}</span>
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setShowImageDialog(true)}>
              <ImageIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Inserir Imagem</span>
            </Button>
          </div>
          <Textarea
            ref={textareaRef}
            id="statement"
            placeholder="Digite o enunciado da questão..."
            value={getDisplayStatement()}
            onChange={(e) => { if (!statement.includes('<img')) setStatement(e.target.value); }}
            rows={4}
            required
            className="resize-y"
          />
          <AnimatePresence>
            {statement && (
              <motion.div
                className="mt-2 p-3 border rounded-lg bg-gray-50 overflow-visible relative"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <p className="text-sm text-gray-600 mb-2">
                  Pré-visualização:
                  {images.length > 0 && <span className="text-xs text-gray-400 ml-2">(Clique na imagem para redimensionar)</span>}
                </p>
                <div className="prose prose-sm max-w-none break-words min-h-[60px]">
                  <div dangerouslySetInnerHTML={{ __html: statement.replace(/<img[^>]*>/gi, '') }} />
                  {images.map((image, idx) => (
                    <div key={idx} className="inline-block relative my-2" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(idx); }}>
                      <Resizable
                        size={{ width: image.width, height: image.height }}
                        onResizeStop={(_e, _dir, _ref, d) => {
                          const w = image.width + d.width;
                          const h = image.height + d.height;
                          setImages((prev) => { const next = [...prev]; next[idx] = { ...image, width: w, height: h }; return next; });
                          updateImageInStatement(idx, w, h);
                        }}
                        enable={Object.fromEntries(
                          ['top','right','bottom','left','topRight','bottomRight','bottomLeft','topLeft'].map(
                            (k) => [k, selectedImageIndex === idx]
                          )
                        ) as any}
                        className={`${selectedImageIndex === idx ? 'ring-2 ring-primary shadow-lg' : 'hover:ring-2 hover:ring-gray-300'} transition-all`}
                        handleStyles={Object.fromEntries(
                          ['top','right','bottom','left','topRight','bottomRight','bottomLeft','topLeft'].map(
                            (k) => [k, { background: '#4BA551', width: k.length > 5 ? '10px' : '8px', height: k.length > 5 ? '10px' : '8px', borderRadius: '50%' }]
                          )
                        )}
                      >
                        <img src={image.src} alt={`Imagem ${idx + 1}`} className="w-full h-full object-contain" style={{ pointerEvents: 'none' }} />
                      </Resizable>
                      {selectedImageIndex === idx && (
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute -top-10 right-0">
                          <Button type="button" size="sm" variant="destructive" className="h-8 w-8 p-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteImage(idx); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 5. Campo de resposta — varia por tipo */}
        <AnimatePresence mode="wait">
          {/* 5A. Múltipla Escolha */}
          {questionType === 'multiple_choice' && (
            <motion.div key="mc" className="space-y-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <Label>Alternativas *</Label>
              <RadioGroup value={String(correctOption)} onValueChange={(v) => setCorrectOption(Number(v))}>
                {options.map((option, index) => (
                  <motion.div key={index} className="flex items-start gap-2 sm:gap-3" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + index * 0.06 }}>
                    <RadioGroupItem value={String(index)} id={`opt-${index}`} className="mt-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`opt-${index}`} className="text-xs sm:text-sm text-gray-500">
                        Opção {String.fromCharCode(65 + index)}
                        {index === correctOption && <span className="ml-2 text-green-600 text-xs font-medium">✓ Correta</span>}
                      </Label>
                      <Input
                        placeholder={`Alternativa ${String.fromCharCode(65 + index)}`}
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        required
                      />
                    </div>
                  </motion.div>
                ))}
              </RadioGroup>
              <p className="text-xs text-gray-500">Selecione o círculo ao lado da alternativa correta</p>
            </motion.div>
          )}

          {/* 5B. Verdadeiro/Falso */}
          {questionType === 'true_false' && (
            <motion.div key="tf" className="space-y-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <Label>Resposta Correta *</Label>
              <div className="grid grid-cols-2 gap-3">
                {[{ label: 'Verdadeiro', value: true }, { label: 'Falso', value: false }].map(({ label, value }) => {
                  const active = correctAnswer === value;
                  return (
                    <motion.button
                      key={label}
                      type="button"
                      onClick={() => setCorrectAnswer(value)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        active ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
                      }`}
                    >
                      <span className="text-sm font-medium">{label}</span>
                      {active && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-600 text-xs">✓</motion.span>}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">Selecione qual é a resposta correta para esta afirmação</p>
            </motion.div>
          )}

          {/* 5C. Questão Aberta */}
          {questionType === 'essay' && (
            <motion.div key="essay" className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }}>
              <PenLine className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-700">Questão Dissertativa</p>
                <p className="text-xs text-gray-500 mt-0.5">O aluno escreverá a resposta livremente. Nenhuma alternativa é necessária.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 6. Ações */}
        <motion.div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-4 border-t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">Cancelar</Button>
          <Button type="submit" className="w-full sm:w-auto">
            {isEditing ? 'Salvar Alterações' : 'Cadastrar Questão'}
          </Button>
        </motion.div>
      </form>
    </>
  );
}