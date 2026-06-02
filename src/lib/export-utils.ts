import type { Question, QuestionType } from '../types/question';
import { getQuestionType } from '../types/question';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export type ExportFormat = 'xml-moodle' | 'csv';

/** Questão parcial retornada pelo parser de importação */
export interface ParsedQuestion {
  statement: string;
  type: QuestionType;
  options: string[];
  correctOption: number;
  correctAnswer?: boolean; // para true_false
  category: string;
  tags: string[];
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
// Inclui coluna Tipo para suportar true_false e essay
// ─────────────────────────────────────────────

export function exportToCsv(questions: Question[]): string {
  const headers = [
    'ID', 'Professor', 'Disciplina', 'Tags', 'Tipo', 'Enunciado',
    'Opção A', 'Opção B', 'Opção C', 'Opção D', 'Opção E',
    'Resposta Correta', 'Verdadeiro/Falso', 'Data de Criação',
  ];

  const typeLabel: Record<QuestionType, string> = {
    multiple_choice: 'Múltipla Escolha',
    true_false: 'Verdadeiro/Falso',
    essay: 'Questão Aberta',
  };

  const escape = (v: string) => String(v ?? '').replace(/"/g, '""');

  const rows = questions.map((q) => {
    const qType = getQuestionType(q);
    return [
      q.id ?? '',
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
      qType === 'multiple_choice'
        ? String.fromCharCode(65 + (q.correctOption ?? 0))
        : '',
      qType === 'true_false'
        ? (q.correctAnswer ? 'VERDADEIRO' : 'FALSO')
        : '',
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
// Suporta multiple_choice, true_false e essay
// ─────────────────────────────────────────────
export function exportToMoodleXml(questions: Question[]): string {
  const xmlParts: string[] = [];

  let currentCategory = '';

  for (const q of questions) {
    const category = (q.category || q.subject || 'Sem disciplina').trim();

    if (category !== currentCategory) {
      currentCategory = category;

      xmlParts.push(`
  <question type="category">
    <category>
      <text>$course$/top/${escapeXml(category)}</text>
    </category>
  </question>`);
    }

    const qType = getQuestionType(q);

    const nameText = escapeXml(
      `${category} - ${stripHtml(q.statement).slice(0, 60)}`
    );

    const statementCdata = `<![CDATA[${q.statement}]]>`;

    const tagsXml =
      (q.tags ?? []).length > 0
        ? `
    <tags>
${q.tags
  .map(
    (tag) =>
      `      <tag><text>${escapeXml(tag)}</text></tag>`
  )
  .join('\n')}
    </tags>`
        : '';

    if (qType === 'multiple_choice') {
      const correctIndex = q.correctOption ?? 0;

      const answersXml = (q.options ?? [])
        .filter(Boolean)
        .map(
          (opt, index) => `
    <answer fraction="${index === correctIndex ? '100' : '0'}" format="html">
      <text><![CDATA[${opt}]]></text>
      <feedback format="html">
        <text></text>
      </feedback>
    </answer>`
        )
        .join('');

      xmlParts.push(`
  <question type="multichoice">
    <name>
      <text>${nameText}</text>
    </name>
    <questiontext format="html">
      <text>${statementCdata}</text>
    </questiontext>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>abc</answernumbering>
${answersXml}${tagsXml}
  </question>`);
    }

    else if (qType === 'true_false') {
      const trueCorrect = q.correctAnswer ?? true;

      xmlParts.push(`
  <question type="truefalse">
    <name>
      <text>${nameText}</text>
    </name>
    <questiontext format="html">
      <text>${statementCdata}</text>
    </questiontext>

    <answer fraction="${trueCorrect ? '100' : '0'}">
      <text>true</text>
    </answer>

    <answer fraction="${trueCorrect ? '0' : '100'}">
      <text>false</text>
    </answer>

${tagsXml}
  </question>`);
    }

    else {
      xmlParts.push(`
  <question type="essay">
    <name>
      <text>${nameText}</text>
    </name>
    <questiontext format="html">
      <text>${statementCdata}</text>
    </questiontext>
${tagsXml}
  </question>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${xmlParts.join('\n')}
</quiz>`;
}

// ─────────────────────────────────────────────
// IMPORTAR MOODLE XML
// Suporta multichoice, truefalse e essay
// ─────────────────────────────────────────────
export function importFromMoodleXml(xmlContent: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  let doc: Document;

  try {
    const parser = new DOMParser();

    doc = parser.parseFromString(
      xmlContent,
      'application/xml'
    );

    if (doc.querySelector('parsererror')) {
      return {
        success: false,
        questions: [],
        errors: ['XML inválido'],
        warnings: [],
      };
    }
  } catch {
    return {
      success: false,
      questions: [],
      errors: ['Erro ao ler XML'],
      warnings: [],
    };
  }

  const allNodes = Array.from(
    doc.querySelectorAll('quiz > question')
  );

  let currentCategory = 'Importada do Moodle';

  for (const node of allNodes) {
    try {
      const nodeType = node.getAttribute('type');

      if (nodeType === 'category') {
        const categoryPath =
          node
            .querySelector('category text')
            ?.textContent
            ?.trim() ?? '';

        const lastPart =
          categoryPath.split('/').pop()?.trim() ?? '';

        if (lastPart) {
          currentCategory =
            lastPart
              .split('-')
              .map(
                word =>
                  word.charAt(0).toUpperCase() +
                  word.slice(1).toLowerCase()
              )
              .join(' ');
        }

        continue;
      }

      if (
        nodeType !== 'multichoice' &&
        nodeType !== 'truefalse' &&
        nodeType !== 'essay'
      ) {
        continue;
      }

      const statement =
        node
          .querySelector('questiontext text')
          ?.textContent
          ?.trim() ?? '';

      if (!stripHtml(statement)) {
        continue;
      }

      const tags = Array.from(
        node.querySelectorAll('tags tag text')
      )
        .map(tag => tag.textContent?.trim() ?? '')
        .filter(Boolean);

      let type: QuestionType = 'multiple_choice';

      if (nodeType === 'truefalse') {
        type = 'true_false';
      }

      if (nodeType === 'essay') {
        type = 'essay';
      }

      if (type === 'multiple_choice') {
        const options: string[] = [];
        let correctOption = 0;

        Array.from(node.querySelectorAll('answer')).forEach(
          (answer, index) => {
            const text =
              answer
                .querySelector('text')
                ?.textContent
                ?.trim() ?? '';

            const fraction = Number(
              answer.getAttribute('fraction') ?? '0'
            );

            options.push(text);

            if (fraction > 0) {
              correctOption = index;
            }
          }
        );

        questions.push({
          statement,
          type,
          options,
          correctOption,
          category: currentCategory,
          tags,
        });

        continue;
      }

      if (type === 'true_false') {
        let correctAnswer = true;

        Array.from(node.querySelectorAll('answer')).forEach(
          answer => {
            const fraction = Number(
              answer.getAttribute('fraction') ?? '0'
            );

            const text =
              answer
                .querySelector('text')
                ?.textContent
                ?.toLowerCase()
                ?.trim() ?? '';

            if (fraction > 0) {
              correctAnswer = text === 'true';
            }
          }
        );

        questions.push({
          statement,
          type,
          options: [],
          correctOption: 0,
          correctAnswer,
          category: currentCategory,
          tags,
        });

        continue;
      }

      questions.push({
        statement,
        type: 'essay',
        options: [],
        correctOption: 0,
        category: currentCategory,
        tags,
      });

    } catch (error) {
      console.error(error);
    }
  }

  return {
    success: questions.length > 0,
    questions,
    errors,
    warnings,
  };
}
// ─────────────────────────────────────────────
// IMPORTAR CSV
// Suporta formato com coluna Tipo (novo) e formato legado (sem Tipo)
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
    .replace(/^\uFEFF/, '') // remove BOM
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

  // Detecta formato: novo (com coluna Tipo) vs legado (sem Tipo)
  const headerLine = lines[0].toLowerCase();
  const hasTypeColumn = headerLine.includes('tipo');
  const dataLines = lines.slice(1);

  dataLines.forEach((line, lineIndex) => {
    const cols = parseCSVLine(line);
    const clean = (v: string) => (v ?? '').replace(/^"|"$/g, '').trim();

    if (hasTypeColumn) {
      // Novo formato: ID, Professor, Disciplina, Tags, Tipo, Enunciado, A, B, C, D, E, Resposta, V/F, Data
      if (cols.length < 11) {
        warnings.push(`Linha ${lineIndex + 2}: colunas insuficientes — será ignorada.`);
        return;
      }

      const category    = clean(cols[2]) || 'Importada';
      const tagsRaw     = clean(cols[3]);
      const qType       = csvTypeToQuestionType(clean(cols[4]));
      const statement   = clean(cols[5]);
      const correctRaw  = clean(cols[11]).trim().toUpperCase();
      const tfRaw       = clean(cols[12] ?? '').trim().toUpperCase();

      if (!statement) {
        warnings.push(`Linha ${lineIndex + 2}: enunciado vazio — será ignorada.`);
        return;
      }

      const tags = tagsRaw ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean) : [];

      if (qType === 'essay') {
        questions.push({ statement, type: 'essay', options: [], correctOption: 0, category, tags });
        return;
      }

      if (qType === 'true_false') {
        const correctAnswer = tfRaw === 'VERDADEIRO' || tfRaw === 'TRUE' || tfRaw.startsWith('V');
        questions.push({ statement, type: 'true_false', options: [], correctOption: 0, correctAnswer, category, tags });
        return;
      }

      // multiple_choice
      const options = [clean(cols[6]), clean(cols[7]), clean(cols[8]), clean(cols[9]), clean(cols[10])].filter(Boolean);
      const correctMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      const correctOption = correctMap[correctRaw] ?? 0;

      if (options.length < 2) {
        warnings.push(`Linha ${lineIndex + 2}: menos de 2 alternativas — será ignorada.`);
        return;
      }

      questions.push({ statement, type: 'multiple_choice', options, correctOption, category, tags });

    } else {
      // Formato legado: ID, Professor, Disciplina, Tags, Enunciado, A, B, C, D, E, Resposta, Data
      if (cols.length < 10) {
        warnings.push(`Linha ${lineIndex + 2}: colunas insuficientes — será ignorada.`);
        return;
      }

      const category    = clean(cols[2]) || 'Importada';
      const tagsRaw     = clean(cols[3]);
      const statement   = clean(cols[4]);

      if (!statement) {
        warnings.push(`Linha ${lineIndex + 2}: enunciado vazio — será ignorada.`);
        return;
      }

      const options = [clean(cols[5]), clean(cols[6]), clean(cols[7]), clean(cols[8]), clean(cols[9])].filter(Boolean);
      const correctRaw = clean(cols[10]).toUpperCase();
      const correctMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
      const correctOption = correctMap[correctRaw] ?? 0;
      const tags = tagsRaw ? tagsRaw.split(';').map((t) => t.trim()).filter(Boolean) : [];

      if (options.length < 2) {
        warnings.push(`Linha ${lineIndex + 2}: menos de 2 alternativas — será ignorada.`);
        return;
      }

      questions.push({ statement, type: 'multiple_choice', options, correctOption, category, tags });
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