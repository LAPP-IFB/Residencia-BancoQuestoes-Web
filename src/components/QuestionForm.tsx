import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Question, Subject, User } from '../types/question';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import {
  X,
  Plus,
  Image as ImageIcon,
  Link2,
  Upload,
  Trash2,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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

export function QuestionForm({
  subjects,
  onSubmit,
  onAddSubject,
  onCancel,
  initialQuestion,
  isEditing,
  user,
}: QuestionFormProps) {
  const [subject, setSubject] = useState(initialQuestion?.subject || '');
  const [atuhorId, setAuthorId] = useState();
  const [newsubjectName, setNewsubjectName] = useState('');
  const [tags, setTags] = useState<string[]>(initialQuestion?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [statement, setStatement] = useState(initialQuestion?.statement || '');
  const [options, setOptions] = useState(
    initialQuestion?.options || ['', '', '', '', '']
  );
  const [correctOption, setCorrectOption] = useState<number>(
    initialQuestion?.correctOption || 0
  );

  // Estados do Modal de Imagem
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );
  const [images, setImages] = useState<ImageState[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Lógica de Imagens ---
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(statement, 'text/html');
    const imgElements = doc.querySelectorAll('img');
    const extractedImages: ImageState[] = Array.from(imgElements).map((img) => {
      const style = img.getAttribute('style') || '';
      const widthMatch = style.match(/width:\s*(\d+)px/);
      const heightMatch = style.match(/height:\s*(\d+)px/);
      return {
        src: img.src,
        width: widthMatch ? parseInt(widthMatch[1]) : 300,
        height: heightMatch ? parseInt(heightMatch[1]) : 200,
      };
    });
    if (JSON.stringify(extractedImages) !== JSON.stringify(images)) {
      setImages(extractedImages);
    }
  }, [statement]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.inline-block.relative')) {
        setSelectedImageIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch(
          'https://bancodequestoes-api.onrender.com/tags'
        );
        if (response.ok) {
          const tagsData = await response.json();
          // Assuming the API returns array of objects with 'name' property
          const tagNames = tagsData.map((tag: any) => tag.name || tag);
          setAvailableTags(tagNames);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };

    fetchTags();
  }, []);

  const updateImageInStatement = (
    index: number,
    width: number,
    height: number
  ) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(statement, 'text/html');
    const imgElements = doc.querySelectorAll('img');
    if (imgElements[index]) {
      imgElements[index].setAttribute(
        'style',
        `width: ${width}px; height: ${height}px;`
      );
      setStatement(doc.body.innerHTML);
    }
  };

  const handleDeleteImage = (index: number) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(statement, 'text/html');
    const imgElements = doc.querySelectorAll('img');
    if (imgElements[index]) {
      const img = imgElements[index];
      const prevSibling = img.previousSibling;
      const nextSibling = img.nextSibling;
      if (prevSibling && prevSibling.nodeName === 'BR') prevSibling.remove();
      if (nextSibling && nextSibling.nodeName === 'BR') nextSibling.remove();
      img.remove();
      setStatement(doc.body.innerHTML);
      setSelectedImageIndex(null);
    }
  };

  const getDisplayStatement = () => {
    return statement.replace(/<img[^>]*>/gi, '').replace(/<br>/gi, '\n');
  };

  const handleInsertImageUrl = () => {
    if (imageUrl.trim()) {
      const imageId = `img-${Date.now()}`;
      setStatement(
        statement +
          `<br><img src="${imageUrl.trim()}" alt="Imagem" style="width: 300px; height: 200px;" data-id="${imageId}" /><br>`
      );
      setImageUrl('');
      setShowImageDialog(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        const imageId = `img-${Date.now()}`;
        setStatement(
          statement +
            `<br><img src="${base64String}" alt="${file.name}" style="width: 300px; height: 200px;" data-id="${imageId}" /><br>`
        );
        setShowImageDialog(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Outras Funções ---
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddAvailableTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreatesubject = async () => {
    if (newsubjectName.trim()) {
      const newsubject = await onAddSubject(newsubjectName.trim());
      if (newsubject) {
        setSubject(newsubject.name);
        setNewsubjectName('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !statement.trim() || options.some((o) => !o.trim())) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const data = {
      subject,
      tags,
      statement,
      options,
      correctOption,
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(
        'https://bancodequestoes-api.onrender.com/questions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error('Erro ao salvar questão');
      const savedQuestion = await response.json();
      alert(`Questão adicionada com sucesso! ID: ${savedQuestion.id}`);
      onSubmit(savedQuestion);
      onCancel();
    } catch (error) {
      alert(`Erro: ${(error as Error).message}`);
    }
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'underline') => {
    const textarea = document.getElementById(
      'statement'
    ) as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentStatementText = getDisplayStatement();
    const selectedText = currentStatementText.substring(start, end);
    if (!selectedText) return;
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `<strong>${selectedText}</strong>`;
        break;
      case 'italic':
        formattedText = `<em>${selectedText}</em>`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
    }
    const newStatementText =
      currentStatementText.substring(0, start) +
      formattedText +
      currentStatementText.substring(end);
    setStatement(
      statement.replace(new RegExp(currentStatementText), newStatementText)
    );
  };

  return (
    <>
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="w-full max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Inserir Imagem</DialogTitle>
            <DialogDescription>
              Escolha entre fazer upload de uma imagem ou inserir um link
              externo
            </DialogDescription>
          </DialogHeader>

          <div className="w-full">
            {/* --- CORREÇÃO AQUI --- */}
            {/* Usei 'flex w-full' para garantir horizontalidade */}
            {/* Usei 'flex-1' nos botões para dividirem o espaço igualmente */}
            <div className="flex w-full p-1 bg-gray-100 rounded-lg mb-6 relative">
              {/* Botão Upload */}
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 relative flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors z-10 rounded-md outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 ${
                  activeTab === 'upload'
                    ? 'text-black'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {activeTab === 'upload' && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-white rounded-md shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-2 z-20">
                  <Upload className="h-4 w-4" />
                  Upload
                </span>
              </button>

              {/* Botão Link */}
              <button
                onClick={() => setActiveTab('url')}
                className={`flex-1 relative flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors z-10 rounded-md outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300 ${
                  activeTab === 'url'
                    ? 'text-black'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {activeTab === 'url' && (
                  <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 bg-white rounded-md shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative flex items-center gap-2 z-20">
                  <Link2 className="h-4 w-4" />
                  Link
                </span>
              </button>
            </div>

            {/* Conteúdo das Abas */}
            <AnimatePresence mode="wait">
              {activeTab === 'upload' ? (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Selecionar arquivo de imagem</Label>
                    <div className="flex flex-col gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload-input"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-12 border-gray-200"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Escolher Arquivo
                      </Button>
                      <p className="text-xs text-gray-500 text-center">
                        Formatos aceitos: JPG, PNG, GIF, SVG (máx. 5MB)
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="url"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="image-url">URL da imagem</Label>
                    <Input
                      id="image-url"
                      type="url"
                      placeholder="https://exemplo.com/imagem.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleInsertImageUrl();
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleInsertImageUrl}
                    disabled={!imageUrl.trim()}
                  >
                    Inserir Imagem
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Label htmlFor="subject">Disciplina *</Label>
          <div className="flex gap-2">
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione uma disciplina" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.name}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Nova disciplina"
              value={newsubjectName}
              onChange={(e) => setNewsubjectName(e.target.value)}
              className="flex-1"
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="outline"
                onClick={handleCreatesubject}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Criar</span>
              </Button>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Label htmlFor="tags">Tags / Palavras-chave</Label>
          <div className="flex gap-2">
            <Input
              id="tags"
              placeholder="Digite uma tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1"
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
          <AnimatePresence>
            {tags.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-2 mt-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {tags.map((tag, index) => (
                  <motion.div
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Badge className="gap-1">
                      {tag}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveTag(tag)}
                      />
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Available Tags */}
          {availableTags.length > 0 && (
            <motion.div
              className="mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Label className="text-sm text-gray-600 mb-2 block">
                Tags disponíveis:
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag, index) => (
                  <motion.div
                    key={`available-${tag}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.02 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Badge
                      variant={tags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/20"
                      onClick={() => handleAddAvailableTag(tag)}
                    >
                      {tag}
                    </Badge>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Clique nas tags para adicioná-las à questão
              </p>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Label htmlFor="statement">Enunciado *</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('bold')}
              >
                <span className="hidden sm:inline">Negrito</span>
                <span className="sm:hidden">N</span>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('italic')}
              >
                <span className="hidden sm:inline">Itálico</span>
                <span className="sm:hidden">I</span>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyFormatting('underline')}
              >
                <span className="hidden sm:inline">Sublinhado</span>
                <span className="sm:hidden">S</span>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowImageDialog(true)}
              >
                <ImageIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Inserir Imagem</span>
              </Button>
            </motion.div>
          </div>

          <Textarea
            ref={textareaRef}
            id="statement"
            placeholder="Digite o enunciado da questão..."
            value={getDisplayStatement()}
            onChange={(e) => setStatement(e.target.value)}
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
                <p className="text-sm text-gray-600 mb-3">
                  Pré-visualização:
                  <span className="text-xs text-gray-500 ml-2">
                    (Clique na imagem para redimensionar ou excluir)
                  </span>
                </p>
                <div className="prose prose-sm max-w-none break-words min-h-[100px]">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: statement.replace(/<img[^>]*>/gi, ''),
                    }}
                  />
                  {images.map((image, index) => (
                    <div
                      key={index}
                      className="inline-block relative my-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(index);
                      }}
                    >
                      <Resizable
                        size={{ width: image.width, height: image.height }}
                        onResizeStop={(e, direction, ref, d) => {
                          const newWidth = image.width + d.width;
                          const newHeight = image.height + d.height;
                          const updatedImages = [...images];
                          updatedImages[index] = {
                            ...image,
                            width: newWidth,
                            height: newHeight,
                          };
                          setImages(updatedImages);
                          updateImageInStatement(index, newWidth, newHeight);
                        }}
                        enable={{
                          top: selectedImageIndex === index,
                          right: selectedImageIndex === index,
                          bottom: selectedImageIndex === index,
                          left: selectedImageIndex === index,
                          topRight: selectedImageIndex === index,
                          bottomRight: selectedImageIndex === index,
                          bottomLeft: selectedImageIndex === index,
                          topLeft: selectedImageIndex === index,
                        }}
                        className={`${
                          selectedImageIndex === index
                            ? 'ring-2 ring-primary shadow-lg'
                            : 'hover:ring-2 hover:ring-gray-300'
                        } transition-all`}
                        handleStyles={{
                          top: {
                            background: '#4BA551',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                          },
                          right: {
                            background: '#4BA551',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                          },
                          bottom: {
                            background: '#4BA551',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                          },
                          left: {
                            background: '#4BA551',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                          },
                          topRight: {
                            background: '#4BA551',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                          },
                          bottomRight: {
                            background: '#4BA551',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                          },
                          bottomLeft: {
                            background: '#4BA551',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                          },
                          topLeft: {
                            background: '#4BA551',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                          },
                        }}
                      >
                        <img
                          src={image.src}
                          alt={`Imagem ${index + 1}`}
                          className="w-full h-full object-contain"
                          style={{ pointerEvents: 'none' }}
                        />
                      </Resizable>
                      {selectedImageIndex === index && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute -top-10 right-0 flex gap-1"
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(index);
                            }}
                          >
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

        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Label>Alternativas *</Label>
          <RadioGroup
            value={String(correctOption)}
            onValueChange={(value: string) => setCorrectOption(Number(value))}
          >
            {options.map((option, index) => (
              <motion.div
                key={index}
                className="flex items-start gap-2 sm:gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <RadioGroupItem
                  value={String(index)}
                  id={`option-${index}`}
                  className="mt-3 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`option-${index}`}
                    className="text-xs sm:text-sm text-gray-600"
                  >
                    Opção {String.fromCharCode(65 + index)}
                  </Label>
                  <Input
                    placeholder={`Digite a alternativa ${String.fromCharCode(
                      65 + index
                    )}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    required
                  />
                </div>
              </motion.div>
            ))}
          </RadioGroup>
          <p className="text-xs sm:text-sm text-gray-500">
            Selecione a alternativa correta marcando o círculo ao lado
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-4 border-t"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto"
          >
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto"
          >
            <Button type="submit" className="w-full sm:w-auto">
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Questão'}
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </>
  );
}
