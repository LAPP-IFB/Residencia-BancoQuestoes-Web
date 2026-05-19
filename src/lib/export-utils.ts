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
  const questionsXml = questions.map((q) => {
    const qType = getQuestionType(q);
    const nameText = escapeXml(
      `${q.category || 'Sem disciplina'} - ${stripHtml(q.statement).slice(0, 60)}...`
    );
    const statementCdata = `<![CDATA[${q.statement}]]>`;
    const tagsXml =
      (q.tags ?? []).length > 0
        ? `\n    <tags>\n${q.tags.map((t) => `      <tag><text>${escapeXml(t)}</text></tag>`).join('\n')}\n    </tags>`
        : '';

    // ── Múltipla escolha ─────────────────────────────────────────────────
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

      return `
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
  </question>`;
    }

    // ── Verdadeiro/Falso ─────────────────────────────────────────────────
    if (qType === 'true_false') {
      const trueCorrect = q.correctAnswer ?? true;
      return `
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
  </question>`;
    }

    // ── Questão aberta (essay) ────────────────────────────────────────────
    return `
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
  </question>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${questionsXml.join('\n')}
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

  const questionNodes = doc.querySelectorAll(
    'question[type="multichoice"], question[type="truefalse"], question[type="essay"]'
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
      const moodleType = node.getAttribute('type') ?? '';

      // Mapeia tipo Moodle → tipo interno
      let type: QuestionType = 'multiple_choice';
      if (moodleType === 'truefalse') type = 'true_false';
      if (moodleType === 'essay') type = 'essay';

      // Enunciado
      const statementRaw = node.querySelector('questiontext text')?.textContent?.trim() ?? '';
      if (!stripHtml(statementRaw)) {
        warnings.push(`Questão ${index + 1}: enunciado vazio — será ignorada.`);
        return;
      }
      const statement = statementRaw; // mantém HTML (renderizado com dangerouslySetInnerHTML)

      // Tags
      const tags: string[] = Array.from(node.querySelectorAll('tags tag text'))
        .map((t) => t.textContent?.trim() ?? '')
        .filter(Boolean);

      // Categoria — infere pelo campo <name> ou fallback para tags
      const nameText = node.querySelector('name text')?.textContent?.trim() ?? '';
      const categoryFromName = nameText.includes(' - ') ? nameText.split(' - ')[0].trim() : '';
      const category = categoryFromName || tags[0] || 'Importada do Moodle';

      // ── Múltipla escolha ───────────────────────────────────────────────
      if (type === 'multiple_choice') {
        const answerNodes = node.querySelectorAll('answer');
        const options: string[] = [];
        let correctOption = 0;
        let optIdx = 0;

        answerNodes.forEach((answer) => {
          // :scope > text evita pegar texto do <feedback>
          const textEl = answer.querySelector(':scope > text') ?? answer.querySelector('text');
          const rawText = textEl?.textContent?.trim() ?? '';
          const text = stripHtml(rawText); // remove <p dir="ltr"> que o Moodle injeta
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

        questions.push({ statement, type, options, correctOption, category, tags });
        return;
      }

      // ── Verdadeiro/Falso ───────────────────────────────────────────────
      if (type === 'true_false') {
        let correctAnswer = true;
        node.querySelectorAll('answer').forEach((answer) => {
          const fraction = parseFloat(answer.getAttribute('fraction') ?? '0');
          const text = answer.querySelector('text')?.textContent?.trim().toLowerCase() ?? '';
          if (fraction > 0) correctAnswer = text === 'true';
        });

        questions.push({
          statement, type, options: [], correctOption: 0,
          correctAnswer, category, tags,
        });
        return;
      }

      // ── Questão aberta (essay) ─────────────────────────────────────────
      if (type === 'essay') {
        questions.push({
          statement, type, options: [], correctOption: 0, category, tags,
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