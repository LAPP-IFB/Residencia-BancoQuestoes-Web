import type { Question, QuestionType } from '../types/question';
import { getQuestionType } from '../types/question';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export type ExportFormat = 'xml-moodle' | 'csv';

/** Questão parcial retornada pelo parser de importação */
export interface ParsedQuestion {
  statement: string;
  options: string[];
  correctOption: number;
  category: string;
  tags: string[];
  type: QuestionType;
  correctAnswer?: boolean; // para true_false
}

export interface ImportResult {
  success: boolean;
  questions: ParsedQuestion[];
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────
// EXPORTAR CSV
// ─────────────────────────────────────────────

export function exportToCsv(questions: Question[]): string {
  const headers = [
    'ID', 'Professor', 'Disciplina', 'Tags', 'Tipo', 'Enunciado',
    'Opção A', 'Opção B', 'Opção C', 'Opção D', 'Opção E',
    'Resposta Correta', 'Data de Criação',
  ];

  const typeLabel: Record<QuestionType, string> = {
    multiple_choice: 'Múltipla Escolha',
    true_false: 'Verdadeiro/Falso',
    essay: 'Questão Aberta',
  };

  const escape = (v: string) => v.replace(/"/g, '""');

  const rows = questions.map((q) => {
    const qType = getQuestionType(q);
    let correctLabel = '';
    if (qType === 'multiple_choice') {
      correctLabel = String.fromCharCode(65 + (q.correctOption ?? 0));
    } else if (qType === 'true_false') {
      correctLabel = (q.correctAnswer ?? true) ? 'Verdadeiro' : 'Falso';
    }
    return [
      q.id,
      q.authorName,
      q.category,
      (q.tags ?? []).join('; '),
      typeLabel[qType],
      escape(stripHtml(q.statement)),
      escape(q.options?.[0] ?? ''),
      escape(q.options?.[1] ?? ''),
      escape(q.options?.[2] ?? ''),
      escape(q.options?.[3] ?? ''),
      escape(q.options?.[4] ?? ''),
      correctLabel,
      q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : '',
    ];
  });

  return [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');
}

// ─────────────────────────────────────────────
// EXPORTAR MOODLE XML
// ─────────────────────────────────────────────

/** Gera um bloco <question type="category"> para a disciplina informada. */
function categoryBlock(subjectName: string): string {
  const safeName = subjectName.toLowerCase().replace(/\s+/g, '_');
  return `
  <question type="category">
    <category>
      <text>$course$/top/${escapeXml(safeName)}</text>
    </category>
    <info format="html">
      <text></text>
    </info>
    <idnumber></idnumber>
  </question>`;
}

export function exportToMoodleXml(questions: Question[]): string {
  // Agrupar questões por disciplina para emitir blocos de categoria
  const blocks: string[] = [];
  let lastSubject = '';

  questions.forEach((q) => {
    const subject = q.subject || q.category || 'Sem disciplina';

    if (subject !== lastSubject) {
      blocks.push(categoryBlock(subject));
      lastSubject = subject;
    }

    const qType = getQuestionType(q);
    const nameText = escapeXml(
      `${subject} - ${stripHtml(q.statement).slice(0, 60)}…`
    );
    const statementCdata = `<![CDATA[${q.statement}]]>`;
    const tagsXml =
      (q.tags ?? []).length > 0
        ? `\n    <tags>\n${q.tags.map((t) => `      <tag><text>${escapeXml(t)}</text></tag>`).join('\n')}\n    </tags>`
        : '';

    // ── Múltipla escolha ───────────────────────────────────────────────────
    if (qType === 'multiple_choice') {
      const correctIndex = q.correctOption ?? 0;
      const answersXml = (q.options ?? [])
        .filter(Boolean)
        .map((opt, i) => `
    <answer fraction="${i === correctIndex ? '100' : '0'}" format="html">
      <text><![CDATA[${opt}]]></text>
      <feedback format="html"><text></text></feedback>
    </answer>`)
        .join('');

      blocks.push(`
  <question type="multichoice">
    <name><text>${nameText}</text></name>
    <questiontext format="html"><text>${statementCdata}</text></questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>1</defaultgrade>
    <penalty>0.3333333</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>abc</answernumbering>
    <showstandardinstruction>0</showstandardinstruction>
    <correctfeedback format="html"><text>Sua resposta está correta.</text></correctfeedback>
    <partiallycorrectfeedback format="html"><text>Sua resposta está parcialmente correta.</text></partiallycorrectfeedback>
    <incorrectfeedback format="html"><text>Sua resposta está incorreta.</text></incorrectfeedback>
    <shownumcorrect/>${answersXml}${tagsXml}
  </question>`);
      return;
    }

    // ── Verdadeiro/Falso ───────────────────────────────────────────────────
    if (qType === 'true_false') {
      const trueCorrect = q.correctAnswer ?? true;
      blocks.push(`
  <question type="truefalse">
    <name><text>${nameText}</text></name>
    <questiontext format="html"><text>${statementCdata}</text></questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>1</defaultgrade>
    <penalty>1.0000000</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
    <answer fraction="${trueCorrect ? '100' : '0'}" format="moodle_auto_format">
      <text>true</text>
      <feedback format="html"><text></text></feedback>
    </answer>
    <answer fraction="${trueCorrect ? '0' : '100'}" format="moodle_auto_format">
      <text>false</text>
      <feedback format="html"><text></text></feedback>
    </answer>${tagsXml}
  </question>`);
      return;
    }

    // ── Questão aberta (essay) ─────────────────────────────────────────────
    blocks.push(`
  <question type="essay">
    <name><text>${nameText}</text></name>
    <questiontext format="html"><text>${statementCdata}</text></questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>1.0000000</defaultgrade>
    <penalty>0.0000000</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
    <responseformat>plain</responseformat>
    <responserequired>1</responserequired>
    <responsefieldlines>10</responsefieldlines>
    <minwordlimit></minwordlimit>
    <maxwordlimit></maxwordlimit>
    <attachments>0</attachments>
    <attachmentsrequired>0</attachmentsrequired>
    <maxbytes>0</maxbytes>
    <filetypeslist></filetypeslist>
    <graderinfo format="html"><text></text></graderinfo>
    <responsetemplate format="html"><text></text></responsetemplate>${tagsXml}
  </question>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${blocks.join('\n')}
</quiz>`;
}

// ─────────────────────────────────────────────
// IMPORTAR MOODLE XML
// ─────────────────────────────────────────────

/**
 * Extrai o nome da disciplina de um path Moodle como "$course$/top/geografia"
 * → "Geografia"
 */
function parseCategoryPath(path: string): string {
  const parts = path.split('/').map((p) => p.trim()).filter(Boolean);
  // Remove prefixos como "$course$", "top"
  const name = parts[parts.length - 1] ?? '';
  // Capitaliza a primeira letra
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function importFromMoodleXml(xmlContent: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlContent, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        success: false, questions: [],
        errors: ['O arquivo XML está malformado. Verifique se foi exportado corretamente do Moodle.'],
        warnings: [],
      };
    }
  } catch {
    return {
      success: false, questions: [],
      errors: ['Não foi possível processar o arquivo XML.'],
      warnings: [],
    };
  }

  // ── Mapear categoria por posição no DOM ──────────────────────────────────
  // Percorre todos os <question> filhos diretos do <quiz> em ordem de documento.
  // Quando encontra um type="category", atualiza a categoria corrente.
  // As questões subsequentes herdam essa categoria.
  const allQuestionNodes = Array.from(doc.querySelectorAll('quiz > question'));

  // Mapa: nó de questão → categoria vigente
  const categoryMap = new Map<Element, string>();
  let currentCategory = '';
  allQuestionNodes.forEach((node) => {
    if (node.getAttribute('type') === 'category') {
      const path = node.querySelector('category text')?.textContent?.trim() ?? '';
      if (path) currentCategory = parseCategoryPath(path);
    } else {
      categoryMap.set(node, currentCategory);
    }
  });

  // Selecionar todos os tipos suportados (exceto category)
  const questionNodes = doc.querySelectorAll(
    'question[type="multichoice"], question[type="essay"], question[type="truefalse"]'
  );

  if (questionNodes.length === 0) {
    return {
      success: false, questions: [],
      errors: [
        'Nenhuma questão suportada encontrada. ' +
        'São aceitos: Múltipla Escolha (multichoice), Verdadeiro/Falso (truefalse) e Questão Aberta (essay).',
      ],
      warnings: [],
    };
  }

  questionNodes.forEach((node, index) => {
    try {
      const xmlType = node.getAttribute('type') ?? '';

      // ── Enunciado (comum a todos) ─────────────────────────────────────
      const statementRaw = node.querySelector('questiontext text')?.textContent?.trim() ?? '';
      if (!stripHtml(statementRaw)) {
        warnings.push(`Questão ${index + 1}: enunciado vazio — será ignorada.`);
        return;
      }
      const statement = statementRaw; // mantém HTML (renderizado com dangerouslySetInnerHTML)

      // ── Tags ─────────────────────────────────────────────────────────
      const tags: string[] = Array.from(node.querySelectorAll('tags tag text'))
        .map((t) => t.textContent?.trim() ?? '')
        .filter(Boolean);

      // ── Categoria ────────────────────────────────────────────────────
      // Prioridade: bloco <question type="category"> > nome da questão > tags > fallback
      const categoryFromBlock = categoryMap.get(node) ?? '';
      const nameText = node.querySelector('name text')?.textContent?.trim() ?? '';
      const categoryFromName = nameText.includes(' - ') ? nameText.split(' - ')[0].trim() : '';
      const category = categoryFromBlock || categoryFromName || tags[0] || 'Importada do Moodle';

      // ── MÚLTIPLA ESCOLHA ─────────────────────────────────────────────
      if (xmlType === 'multichoice') {
        const answerNodes = node.querySelectorAll('answer');
        const options: string[] = [];
        let correctOption = 0;
        let optIdx = 0;

        answerNodes.forEach((answer) => {
          const textEl = answer.querySelector('text');
          const rawText = textEl?.textContent?.trim() ?? '';
          // ← strip HTML: Moodle envolve alternativas em <p dir="ltr">...</p>
          const text = stripHtml(rawText);
          const fraction = parseFloat(answer.getAttribute('fraction') ?? '0');
          if (text) {
            options.push(text);
            if (fraction > 0) correctOption = optIdx;
            optIdx++;
          }
        });

        if (options.length < 2) {
          warnings.push(`Questão ${index + 1}: menos de 2 alternativas válidas — será ignorada.`);
          return;
        }

        questions.push({ statement, options, correctOption, category, tags, type: 'multiple_choice' });
        return;
      }

      // ── VERDADEIRO/FALSO ──────────────────────────────────────────────
      if (xmlType === 'truefalse') {
        let correctAnswer = true; // default: Verdadeiro é correto
        const answerNodes = node.querySelectorAll('answer');
        answerNodes.forEach((answer) => {
          const fraction = parseFloat(answer.getAttribute('fraction') ?? '0');
          const text = answer.querySelector('text')?.textContent?.trim().toLowerCase() ?? '';
          if (fraction > 0) {
            correctAnswer = text === 'true';
          }
        });

        questions.push({
          statement,
          options: [],
          correctOption: 0,
          category,
          tags,
          type: 'true_false',
          correctAnswer,
        });
        return;
      }

      // ── QUESTÃO ABERTA (essay) ────────────────────────────────────────
      if (xmlType === 'essay') {
        questions.push({
          statement,
          options: [],
          correctOption: 0,
          category,
          tags,
          type: 'essay',
        });
        return;
      }
    } catch {
      warnings.push(`Questão ${index + 1}: erro inesperado ao processar — será ignorada.`);
    }
  });

  if (questions.length === 0) {
    return {
      success: false, questions: [],
      errors: ['Nenhuma questão válida encontrada no arquivo.'],
      warnings,
    };
  }

  return { success: true, questions, errors, warnings };
}

// ─────────────────────────────────────────────
// IMPORTAR CSV
// ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current); current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function csvTypeToQuestionType(raw: string): QuestionType {
  const v = raw.toLowerCase().trim();
  if (v.includes('aberta') || v === 'essay') return 'essay';
  if (v.includes('verdadeiro') || v.includes('falso') || v === 'true_false') return 'true_false';
  return 'multiple_choice';
}

export function importFromCsv(csvContent: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());

  if (lines.length < 2) {
    return {
      success: false, questions: [],
      errors: ['Arquivo CSV vazio ou sem linhas de dados.'],
      warnings: [],
    };
  }

  // Detectar formato: novo (com coluna Tipo no índice 4) vs legado (sem Tipo)
  const headerLine = lines[0].toLowerCase();
  const hasTypeColumn = headerLine.includes('tipo');
  const dataLines = lines.slice(1);

  dataLines.forEach((line, lineIndex) => {
    const cols = parseCSVLine(line);
    const clean = (v: string) => (v ?? '').replace(/^"|"$/g, '').trim();

    if (hasTypeColumn) {
      // Novo formato: ID, Professor, Disciplina, Tags, Tipo, Enunciado, A, B, C, D, E, Resposta, Data
      if (cols.length < 11) {
        warnings.push(`Linha ${lineIndex + 2}: colunas insuficientes — será ignorada.`);
        return;
      }
      const category   = clean(cols[2]) || 'Importada';
      const tagsRaw    = clean(cols[3]);
      const qType      = csvTypeToQuestionType(clean(cols[4]));
      const statement  = clean(cols[5]);
      const correctRaw = clean(cols[11]).trim();

      if (!statement) {
        warnings.push(`Linha ${lineIndex + 2}: enunciado vazio — será ignorada.`);
        return;
      }

      const tags = tagsRaw ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean) : [];

      if (qType === 'essay') {
        questions.push({ statement, options: [], correctOption: 0, category, tags, type: 'essay' });
        return;
      }
      if (qType === 'true_false') {
        const correctAnswer = correctRaw.toLowerCase().startsWith('v') || correctRaw.toLowerCase() === 'true';
        questions.push({ statement, options: [], correctOption: 0, category, tags, type: 'true_false', correctAnswer });
        return;
      }
      // multiple_choice
      const options = [clean(cols[6]), clean(cols[7]), clean(cols[8]), clean(cols[9]), clean(cols[10])].filter(Boolean);
      const correctMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      const correctOption = correctMap[correctRaw.toUpperCase()] ?? 0;
      if (options.length < 2) {
        warnings.push(`Linha ${lineIndex + 2}: menos de 2 alternativas — será ignorada.`);
        return;
      }
      questions.push({ statement, options, correctOption, category, tags, type: 'multiple_choice' });
    } else {
      // Formato legado: ID, Professor, Disciplina, Tags, Enunciado, A, B, C, D, E, Resposta, Data
      if (cols.length < 10) {
        warnings.push(`Linha ${lineIndex + 2}: colunas insuficientes — será ignorada.`);
        return;
      }
      const category   = clean(cols[2]) || 'Importada';
      const tagsRaw    = clean(cols[3]);
      const statement  = clean(cols[4]);
      if (!statement) { warnings.push(`Linha ${lineIndex + 2}: enunciado vazio — será ignorada.`); return; }
      const options    = [clean(cols[5]), clean(cols[6]), clean(cols[7]), clean(cols[8]), clean(cols[9])].filter(Boolean);
      const correctRaw = clean(cols[10]).toUpperCase();
      const correctMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      const correctOption = correctMap[correctRaw] ?? 0;
      const tags = tagsRaw ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean) : [];
      if (options.length < 2) { warnings.push(`Linha ${lineIndex + 2}: menos de 2 alternativas — será ignorada.`); return; }
      questions.push({ statement, options, correctOption, category, tags, type: 'multiple_choice' });
    }
  });

  if (questions.length === 0) {
    return {
      success: false, questions: [],
      errors: ['Nenhuma questão válida encontrada no arquivo CSV.'],
      warnings,
    };
  }

  return { success: true, questions, errors, warnings };
}