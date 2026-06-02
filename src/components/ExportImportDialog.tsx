import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import {
  Download, Upload, FileSpreadsheet, FileCode, CheckCircle2,
  AlertCircle, FileUp, Loader2, Info, RotateCcw, FileText,
  X, ListChecks, ToggleLeft, PenLine, BookOpen,
} from 'lucide-react';
import {
  exportToMoodleXml,
  exportToCsv,
  importFromMoodleXml,
  importFromCsv,
  downloadFile,
  type ExportFormat,
  type ImportResult,
} from '../lib/export-utils';
import type { Question } from '../types/question';
import { getQuestionType } from '../types/question';

interface ExportImportDialogProps {
  questions: Question[];
  onImport: (
    questions: Pick<Question, 'statement' | 'options' | 'correctOption' | 'category' | 'tags' | 'type' | 'correctAnswer'>[]
  ) => void;
  trigger?: React.ReactNode;
}

type ImportFormat = 'xml' | 'csv';
type PendingQuestion = ImportResult['questions'][number];

// Ícone por tipo de questão
const TYPE_ICON: Record<string, React.ElementType> = {
  multiple_choice: ListChecks,
  true_false: ToggleLeft,
  essay: PenLine,
};

export function ExportImportDialog({ questions, onImport, trigger }: ExportImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // ── Estado de exportação ──────────────────────────────────────────────────
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xml-moodle');
  const [isExporting, setIsExporting] = useState(false);
  // Snapshot das questões ao abrir — permite remover individualmente da fila
  const [exportQueue, setExportQueue] = useState<Question[]>([]);

  // ── Estado de importação ──────────────────────────────────────────────────
  const [importFormat, setImportFormat] = useState<ImportFormat>('xml');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  // Lista editável de questões prontas para importar (o usuário pode descartar individualmente)
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Captura snapshot ao abrir o dialog
  useEffect(() => {
    if (open) setExportQueue([...questions]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza pendingQuestions quando chega resultado de importação
  useEffect(() => {
    if (importResult?.questions) {
      setPendingQuestions(importResult.questions);
    }
  }, [importResult]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetImport = () => {
    setImportResult(null);
    setPendingQuestions([]);
    setSelectedFile(null);
    setIsDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTabChange = (tab: 'export' | 'import') => {
    setActiveTab(tab);
    resetImport();
  };

  // ── Exportação ────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (exportQueue.length === 0) return;
    setIsExporting(true);
    setTimeout(() => {
      try {
        if (exportFormat === 'xml-moodle') {
          const content = exportToMoodleXml(exportQueue);
          downloadFile(content, `questoes-moodle-${Date.now()}.xml`, 'application/xml;charset=utf-8;');
        } else {
          const content = exportToCsv(exportQueue);
          downloadFile('\ufeff' + content, `questoes-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
        }
      } catch (err) {
        console.error('Erro ao exportar:', err);
      } finally {
        setIsExporting(false);
      }
    }, 400);
  };

  // Remove uma questão da fila de exportação — id é number no seu projeto
  const removeFromExportQueue = (id: number | undefined) =>
    setExportQueue((prev) => prev.filter((q) => q.id !== id));

  // ── Importação ────────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    const isXml = file.name.toLowerCase().endsWith('.xml');
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (!isXml && !isCsv) {
      setImportResult({
        success: false,
        questions: [],
        errors: ['Formato não suportado. Selecione um arquivo .xml (Moodle) ou .csv.'],
        warnings: [],
      });
      return;
    }

    setSelectedFile(file);
    setImportFormat(isXml ? 'xml' : 'csv');
    setImportResult(null);
    setPendingQuestions([]);
    setIsProcessing(true);

    try {
      const content = await file.text();
      const result = isXml ? importFromMoodleXml(content) : importFromCsv(content);
      setImportResult(result);
    } catch (err) {
      setImportResult({
        success: false,
        questions: [],
        errors: [`Erro ao ler o arquivo: ${err}`],
        warnings: [],
      });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Remove uma questão do preview antes de confirmar
  const removeFromPending = (idx: number) =>
    setPendingQuestions((prev) => prev.filter((_, i) => i !== idx));

  const handleConfirmImport = () => {
    if (pendingQuestions.length > 0) {
      onImport(pendingQuestions);
      setOpen(false);
      resetImport();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const hasSuccess = !!(importResult?.success && pendingQuestions.length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetImport(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Importar / Exportar
          </Button>
        )}
      </DialogTrigger>

      {/* max-h + flex col para o rodapé nunca sair da tela */}
      <DialogContent
        className="w-full max-w-lg gap-0 p-0"
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
      >

        {/* Cabeçalho fixo */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Importar e Exportar Questões</DialogTitle>
          <DialogDescription>
            Importe questões do Moodle ou exporte suas questões para uso externo.
          </DialogDescription>
        </DialogHeader>

        {/* Tab switcher animado — fixo */}
        <div className="px-6 pb-3 shrink-0">
          <div className="relative flex w-full p-1 bg-muted rounded-lg">
            <motion.div
              className="absolute top-1 bottom-1 rounded-md bg-background shadow-sm"
              animate={{
                left: activeTab === 'export' ? '4px' : '50%',
                right: activeTab === 'export' ? '50%' : '4px',
              }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
            {(['export', 'import'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors rounded-md outline-none cursor-pointer ${
                  activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'export'
                  ? <><Download className="h-4 w-4" />Exportar</>
                  : <><Upload className="h-4 w-4" />Importar</>}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4 min-h-0 pb-2">

          {/* ══════════════ ABA EXPORTAR ══════════════ */}
          {activeTab === 'export' && (
            <>
              {/* Contador */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Questões na fila:</span>
                <Badge variant="secondary">{exportQueue.length} questão(ões)</Badge>
              </div>

              {/* Formato */}
              <div className="space-y-2">
                <Label>Formato de exportação</Label>
                <RadioGroup
                  value={exportFormat}
                  onValueChange={(v) => setExportFormat(v as ExportFormat)}
                  className="space-y-2"
                >
                  <div
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      exportFormat === 'xml-moodle' ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setExportFormat('xml-moodle')}
                  >
                    <RadioGroupItem value="xml-moodle" id="xml-moodle" className="mt-1 shrink-0" />
                    <Label htmlFor="xml-moodle" className="flex-1 cursor-pointer space-y-0.5">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-blue-600" />
                        <span>Moodle XML</span>
                        <Badge variant="outline" className="text-xs">Recomendado</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Compatível com Moodle 3.x e 4.x. Preserva formatação, tags e feedbacks.
                      </p>
                    </Label>
                  </div>

                  <div
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      exportFormat === 'csv' ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setExportFormat('csv')}
                  >
                    <RadioGroupItem value="csv" id="csv" className="mt-1 shrink-0" />
                    <Label htmlFor="csv" className="flex-1 cursor-pointer space-y-0.5">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        <span>CSV</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Compatível com Excel, Google Sheets e outros aplicativos de planilha.
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Dica */}
              <div className="flex items-start gap-3 rounded-lg border p-3 bg-blue-50 border-blue-200 text-blue-700 text-sm">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                <div>
                  <p className="font-medium mb-0.5">Como importar no Moodle</p>
                  <p className="text-xs text-blue-600">
                    Vá em Administração do Curso &gt; Banco de Questões &gt; Importar e selecione o formato
                    &quot;Moodle XML&quot;.
                  </p>
                </div>
              </div>

              {/* Lista de questões na fila com remoção individual */}
              {exportQueue.length > 0 && (
                <div className="space-y-2">
                  <Label>Questões selecionadas para exportar</Label>
                  <p className="text-xs text-muted-foreground">
                    Clique em <X className="inline h-3 w-3" /> para remover uma questão da exportação.
                  </p>
                  <div className="space-y-1.5 rounded-lg border p-2">
                    <AnimatePresence initial={false}>
                      {exportQueue.map((q) => {
                        const qType = getQuestionType(q);
                        const Icon = TYPE_ICON[qType] ?? ListChecks;
                        return (
                          <motion.div
                            key={q.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0, padding: 0 }}
                            transition={{ duration: 0.18 }}
                            className="flex items-start gap-2 p-2 bg-muted rounded"
                          >
                            <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p
                                className="line-clamp-2 text-xs text-muted-foreground"
                                dangerouslySetInnerHTML={{
                                  __html: q.statement.replace(/<[^>]*>/g, '').slice(0, 120),
                                }}
                              />
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <BookOpen className="h-3 w-3" />
                                {q.category || q.subject}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromExportQueue(q.id)}
                              className="shrink-0 p-0.5 rounded hover:bg-destructive/10 text-gray-300 hover:text-destructive transition-colors"
                              title="Remover desta exportação"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {exportQueue.length === 0 && (
                      <p className="text-xs text-center text-muted-foreground py-4">
                        Nenhuma questão na fila.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════════════ ABA IMPORTAR ══════════════ */}
          {activeTab === 'import' && (
            <>
              {/* Zona de drop */}
              <AnimatePresence mode="wait">
                {!hasSuccess && (
                  <motion.div
                    key="dropzone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <Label>Selecionar arquivo</Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                        isDragOver
                          ? 'border-primary bg-primary/5'
                          : selectedFile
                          ? 'border-primary/50 bg-primary/5'
                          : 'hover:border-primary/40 hover:bg-muted/30'
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xml,.csv,application/xml,text/xml,text/csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {isProcessing ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-10 w-10 animate-spin text-primary" />
                          <p className="text-sm">Processando arquivo...</p>
                        </div>
                      ) : selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          {importFormat === 'xml'
                            ? <FileCode className="h-10 w-10 text-blue-500" />
                            : <FileText className="h-10 w-10 text-green-500" />
                          }
                          <p className="font-medium text-foreground text-sm">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB · {importFormat === 'xml' ? 'Moodle XML' : 'CSV'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <FileUp className="h-10 w-10 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">
                            Clique para selecionar ou arraste o arquivo
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Formatos aceitos: Moodle XML (.xml) · CSV (.csv)
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Erros */}
              <AnimatePresence>
                {(importResult?.errors?.length ?? 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Erro na importação</p>
                      <ul className="text-xs space-y-0.5 list-disc list-inside">
                        {importResult!.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Avisos */}
              <AnimatePresence>
                {(importResult?.warnings?.length ?? 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-800"
                  >
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Avisos</p>
                      <ul className="text-xs space-y-0.5 list-disc list-inside">
                        {importResult!.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Preview com remoção individual */}
              <AnimatePresence>
                {hasSuccess && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800">
                          {pendingQuestions.length} questão(ões) prontas para importar
                        </p>
                        <p className="text-xs text-green-600 truncate">{selectedFile?.name}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Questões encontradas</Label>
                      <p className="text-xs text-muted-foreground">
                        Clique em <X className="inline h-3 w-3" /> para descartar uma questão antes de importar.
                      </p>
                    </div>

                    <div className="space-y-1.5 rounded-lg border p-2">
                      <AnimatePresence initial={false}>
                        {pendingQuestions.map((q, idx) => {
                          const qType = q.type ?? 'multiple_choice';
                          const Icon = TYPE_ICON[qType] ?? ListChecks;
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0, padding: 0 }}
                              transition={{ duration: 0.18 }}
                              className="flex items-start gap-2 p-2 bg-muted rounded"
                            >
                              <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                              <span className="text-xs text-gray-400 shrink-0 mt-0.5 w-4 text-right">
                                {idx + 1}.
                              </span>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <p
                                  className="line-clamp-2 text-xs text-muted-foreground"
                                  dangerouslySetInnerHTML={{
                                    __html: q.statement.replace(/<[^>]*>/g, '').slice(0, 120),
                                  }}
                                />
                                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                  <BookOpen className="h-3 w-3" />
                                  {q.category}
                                  {(q.options?.filter(Boolean).length ?? 0) > 0 && (
                                    <span className="ml-1">· {q.options.filter(Boolean).length} alt.</span>
                                  )}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromPending(idx)}
                                className="shrink-0 p-0.5 rounded hover:bg-destructive/10 text-gray-300 hover:text-destructive transition-colors"
                                title="Descartar esta questão"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      {pendingQuestions.length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-4">
                          Todas as questões foram descartadas.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dica inicial */}
              {!hasSuccess && !importResult && (
                <div className="flex items-start gap-3 rounded-lg border p-3 bg-blue-50 border-blue-200 text-blue-700 text-sm">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                  <div>
                    <p className="font-medium mb-0.5">Como exportar do Moodle</p>
                    <p className="text-xs text-blue-600">
                    No Moodle, organize as questões em uma categoria (disciplina), depois vá em Banco de Questões &gt; Exportar, escolha o formato &quot;Moodle XML&quot; e selecione as questões desejadas.
                  </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé fixo com botões de ação */}
        <div className="px-6 pb-6 pt-4 border-t shrink-0">
          {activeTab === 'export' ? (
            <Button
              onClick={handleExport}
              disabled={exportQueue.length === 0 || isExporting}
              className="w-full gap-2"
            >
              {isExporting ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Exportando...</>
              ) : (
                <><Download className="h-4 w-4" />Exportar {exportQueue.length} questão(ões)</>
              )}
            </Button>
          ) : hasSuccess ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetImport} className="flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Outro arquivo
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={pendingQuestions.length === 0}
                className="flex-1 gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar ({pendingQuestions.length})
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full gap-2"
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Processando...</>
              ) : (
                <><FileUp className="h-4 w-4" />Selecionar arquivo</>
              )}
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}