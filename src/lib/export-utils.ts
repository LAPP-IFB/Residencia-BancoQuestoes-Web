import type { Question } from '../types/question';

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export type ExportFormat = 'xml-moodle' | 'csv';

export interface ImportResult {
  success: boolean;
  questions: Question[];
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────
// UTILITÁRIO: download de arquivo
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

// ─────────────────────────────────────────────
// EXPORTAR CSV
// (lógica original de QuestionList.tsx, sem alteração)
// ─────────────────────────────────────────────

export function exportToCsv(questions: Question[]): string {
  const headers = [
    'ID',
    'Professor',
    'Disciplina',
    'Tags',
    'Enunciado',
    'Opção A',
    'Opção B',
    'Opção C',
    'Opção D',
    'Opção E',
    'Resposta Correta',
    'Data de Criação',
  ];

  const rows = questions.map((q) => [
    q.id,
    q.authorName,
    q.subject,
    q.tags?.join('; ') || '',
    q.statement?.replace(/"/g, '""') || '',
    q.options?.[0]?.replace(/"/g, '""') || '',
    q.options?.[1]?.replace(/"/g, '""') || '',
    q.options?.[2]?.replace(/"/g, '""') || '',
    q.options?.[3]?.replace(/"/g, '""') || '',
    q.options?.[4]?.replace(/"/g, '""') || '',
    String.fromCharCode(65 + (q.correctOption || 0)),
    q.createdAt ? new Date(q.createdAt).toLocaleDateString('pt-BR') : '',
  ]);

  return [
    headers.map((h) => `"${h}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');
}

// ─────────────────────────────────────────────
// EXPORTAR MOODLE XML
// ─────────────────────────────────────────────

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportToMoodleXml(questions: Question[]): string {
  const questionsXml = questions.map((q) => {
    // Letra da resposta correta: A, B, C…
    const correctLetter = String.fromCharCode(65 + (q.correctOption || 0));

    const answersXml = q.options
      .filter(Boolean)
      .map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const isCorrect = letter === correctLetter;
        return `
    <answer fraction="${isCorrect ? '100' : '0'}" format="html">
      <text><![CDATA[${option}]]></text>
      <feedback format="html">
        <text>${isCorrect ? 'Correto!' : 'Incorreto.'}</text>
      </feedback>
    </answer>`;
      })
      .join('');

    const tagsXml =
      q.tags?.length > 0
        ? `\n    <tags>\n${q.tags.map((t) => `      <tag><text>${escapeXml(t)}</text></tag>`).join('\n')}\n    </tags>`
        : '';

    return `
  <question type="multichoice">
    <name>
      <text>${escapeXml(q.subject || 'Sem disciplina')} — ${escapeXml(
      q.statement.replace(/<[^>]*>/g, '').slice(0, 60)
    )}...</text>
    </name>
    <questiontext format="html">
      <text><![CDATA[${q.statement}]]></text>
    </questiontext>
    <generalfeedback format="html"><text></text></generalfeedback>
    <defaultgrade>1.0000000</defaultgrade>
    <penalty>0.3333333</penalty>
    <hidden>0</hidden>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>abc</answernumbering>${answersXml}${tagsXml}
  </question>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${questionsXml.join('\n')}
</quiz>`;
}

// ─────────────────────────────────────────────
// IMPORTAR MOODLE XML
// ─────────────────────────────────────────────

export function importFromMoodleXml(xmlContent: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: Question[] = [];

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlContent, 'application/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return {
        success: false,
        questions: [],
        errors: ['O arquivo XML está malformado. Verifique se foi exportado corretamente do Moodle.'],
        warnings: [],
      };
    }
  } catch {
    return {
      success: false,
      questions: [],
      errors: ['Não foi possível processar o arquivo XML.'],
      warnings: [],
    };
  }

  const questionNodes = doc.querySelectorAll('question[type="multichoice"]');

  if (questionNodes.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ['Nenhuma questão de múltipla escolha encontrada. Certifique-se de exportar questões do tipo "Multiple Choice" do Moodle.'],
      warnings: [],
    };
  }

  questionNodes.forEach((node, index) => {
    try {
      // Enunciado
      const statementNode = node.querySelector('questiontext text');
      const statement = statementNode?.textContent?.trim() || '';
      if (!statement) {
        warnings.push(`Questão ${index + 1}: enunciado vazio, será ignorada.`);
        return;
      }

      // Alternativas
      const answerNodes = node.querySelectorAll('answer');
      const options: string[] = [];
      let correctOption = 0;

      answerNodes.forEach((answer, answerIndex) => {
        const text = answer.querySelector('text')?.textContent?.trim() || '';
        const fraction = parseFloat(answer.getAttribute('fraction') || '0');
        if (text) {
          options.push(text);
          if (fraction > 0) {
            correctOption = answerIndex;
          }
        }
      });

      if (options.length < 2) {
        warnings.push(`Questão ${index + 1}: menos de 2 alternativas encontradas, será ignorada.`);
        return;
      }

      // Tags
      const tagNodes = node.querySelectorAll('tags tag text');
      const tags: string[] = Array.from(tagNodes)
        .map((t) => t.textContent?.trim() || '')
        .filter(Boolean);

      // Disciplina: tenta inferir pelo nome da questão ou primeira tag
      const nameText = node.querySelector('name text')?.textContent?.trim() || '';
      const subjectFromName = nameText.includes('—') ? nameText.split('—')[0].trim() : '';
      const subject = subjectFromName || tags[0] || 'Importada do Moodle';

      questions.push({
        authorId: 0, // será preenchido pela aplicação ao salvar
        authorName: 'Importado do Moodle',
        subject,
        tags,
        statement,
        options,
        correctOption,
        createdAt: new Date().toISOString(),
      });
    } catch {
      warnings.push(`Questão ${index + 1}: erro inesperado ao processar, será ignorada.`);
    }
  });

  if (questions.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ['Nenhuma questão válida encontrada no arquivo.'],
      warnings,
    };
  }

  return {
    success: true,
    questions,
    errors,
    warnings,
  };
}
