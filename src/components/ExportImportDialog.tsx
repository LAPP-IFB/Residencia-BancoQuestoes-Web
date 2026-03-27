import { useState, useRef } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Loader2,
  Info,
} from 'lucide-react';
import {
  exportToMoodleXml,
  exportToCsv,
  importFromMoodleXml,
  downloadFile,
  type ExportFormat,
  type ImportResult,
} from '../lib/export-utils';
import type { Question } from '../types/question';

interface ExportImportDialogProps {
  questions: Question[];
  onImport: (questions: Question[]) => void;
  /** Elemento que abre o dialog. Se omitido, usa o botão padrão. */
  trigger?: React.ReactNode;
}

export function ExportImportDialog({
  questions,
  onImport,
  trigger,
}: ExportImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xml-moodle');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Exportar ──────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (questions.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      try {
        if (exportFormat === 'xml-moodle') {
          const xmlContent = exportToMoodleXml(questions);
          downloadFile(
            xmlContent,
            `questoes-moodle-${Date.now()}.xml`,
            'application/xml'
          );
        } else {
          const csvContent = exportToCsv(questions);
          downloadFile(
            '\ufeff' + csvContent,
            `questoes-${Date.now()}.csv`,
            'text/csv;charset=utf-8;'
          );
        }
      } catch (error) {
        console.error('Erro ao exportar:', error);
      }
      setIsProcessing(false);
    }, 500);
  };

  // ── Importar ──────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setImportResult(null);

    try {
      const content = await selectedFile.text();
      const result = importFromMoodleXml(content);
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: false,
        questions: [],
        errors: [`Erro ao ler o arquivo: ${error}`],
        warnings: [],
      });
    }

    setIsProcessing(false);
  };

  const handleConfirmImport = () => {
    if (importResult?.questions && importResult.questions.length > 0) {
      onImport(importResult.questions);
      setOpen(false);
      setImportResult(null);
      setSelectedFile(null);
    }
  };

  const handleReset = () => {
    setImportResult(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Importar / Exportar
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Importar e Exportar Questões</DialogTitle>
          <DialogDescription>
            Importe questões do Moodle ou exporte suas questões para uso
            externo.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Importar
            </TabsTrigger>
          </TabsList>

          {/* ── ABA EXPORTAR ─────────────────────────────────────────────── */}
          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">
                Questões disponíveis para exportação:
              </span>
              <Badge variant="secondary">{questions.length} questões</Badge>
            </div>

            <div className="space-y-3">
              <Label>Formato de exportação</Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as ExportFormat)}
                className="space-y-2"
              >
                {/* XML Moodle */}
                <div
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setExportFormat('xml-moodle')}
                >
                  <RadioGroupItem value="xml-moodle" id="xml-moodle" className="mt-1" />
                  <Label htmlFor="xml-moodle" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-primary" />
                      <span className="font-medium">Moodle XML</span>
                      <Badge variant="outline" className="text-xs">
                        Recomendado
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Compatível com Moodle 3.x e 4.x. Preserva formatação,
                      tags e feedbacks das questões.
                    </p>
                  </Label>
                </div>

                {/* CSV */}
                <div
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setExportFormat('csv')}
                >
                  <RadioGroupItem value="csv" id="csv" className="mt-1" />
                  <Label htmlFor="csv" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <span className="font-medium">CSV</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Compatível com Excel, Google Sheets e outros aplicativos
                      de planilha.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Dica</AlertTitle>
              <AlertDescription>
                Para importar no Moodle, vá em Administração do Curso &gt;
                Banco de Questões &gt; Importar e selecione o formato
                &quot;Moodle XML&quot;.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleExport}
              disabled={questions.length === 0 || isProcessing}
              className="w-full gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportar {questions.length} questões
                </>
              )}
            </Button>
          </TabsContent>

          {/* ── ABA IMPORTAR ─────────────────────────────────────────────── */}
          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-3">
              <Label>Selecionar arquivo</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Clique para selecionar ou arraste o arquivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formato aceito: Moodle XML (.xml)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Resultado da importação */}
            {importResult && (
              <div className="space-y-3">
                {importResult.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erros encontrados</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {importResult.errors.map((error, idx) => (
                          <li key={idx} className="text-sm">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {importResult.warnings.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Avisos</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {importResult.warnings.map((warning, idx) => (
                          <li key={idx} className="text-sm">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {importResult.success && importResult.questions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">
                        {importResult.questions.length} questão(ões) prontas
                        para importar
                      </span>
                    </div>

                    <ScrollArea className="h-[200px] border rounded-lg p-3">
                      <div className="space-y-2">
                        {importResult.questions.map((q, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-muted rounded text-sm"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {q.subject}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {q.options.filter(Boolean).length} alternativas
                              </span>
                            </div>
                            <p className="line-clamp-2 text-foreground">
                              {q.statement
                                .replace(/<[^>]*>/g, '')
                                .slice(0, 100)}
                              ...
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {importResult?.success ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex-1"
                  >
                    Selecionar outro arquivo
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    className="flex-1 gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar importação
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || isProcessing}
                  className="w-full gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Processar arquivo
                    </>
                  )}
                </Button>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Como exportar do Moodle</AlertTitle>
              <AlertDescription className="text-sm">
                No Moodle, vá em Banco de Questões &gt; Exportar, selecione as
                questões e escolha o formato &quot;Moodle XML&quot; para
                download.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
