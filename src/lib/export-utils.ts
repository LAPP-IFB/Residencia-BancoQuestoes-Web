import type { Question } from "../types/question";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export type ExportFormat = "xml-moodle" | "csv";

/** Questão parcial retornada pelo parser de importação */
export interface ParsedQuestion {
  statement: string;
  options: string[];
  correctOption: number;
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

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Escapa caracteres especiais para XML */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Remove tags HTML e converte entidades comuns.
 * Usado para limpar o conteúdo de CDATA do Moodle antes de armazenar
 * em campos exibidos como texto simples (alternativas).
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────
// EXPORTAR CSV
// ─────────────────────────────────────────────

export function exportToCsv(questions: Question[]): string {
  const headers = [
    "ID",
    "Professor",
    "Disciplina",
    "Tags",
    "Enunciado",
    "Opção A",
    "Opção B",
    "Opção C",
    "Opção D",
    "Opção E",
    "Resposta Correta",
    "Data de Criação",
  ];

  const escape = (v: string) => v.replace(/"/g, '""');

  const rows = questions.map((q) => [
    q.id,
    q.authorName,
    q.category, // ← usa q.category
    (q.tags ?? []).join("; "),
    escape(stripHtml(q.statement)),
    escape(q.options?.[0] ?? ""),
    escape(q.options?.[1] ?? ""),
    escape(q.options?.[2] ?? ""),
    escape(q.options?.[3] ?? ""),
    escape(q.options?.[4] ?? ""),
    String.fromCharCode(65 + (q.correctOption ?? 0)),
    q.createdAt
      ? new Date(q.createdAt).toLocaleDateString("pt-BR")
      : "",
  ]);

  return [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell}"`).join(","),
    ),
  ].join("\n");
}

// ─────────────────────────────────────────────
// EXPORTAR MOODLE XML
// ─────────────────────────────────────────────

export function exportToMoodleXml(
  questions: Question[],
): string {
  const questionsXml = questions.map((q) => {
    const correctIndex = q.correctOption ?? 0;

    const answersXml = (q.options ?? [])
      .filter(Boolean)
      .map((option, index) => {
        const isCorrect = index === correctIndex;
        return `
    <answer fraction="${isCorrect ? "100" : "0"}" format="html">
      <text><![CDATA[${option}]]></text>
      <feedback format="html">
        <text></text>
      </feedback>
    </answer>`;
      })
      .join("");

    const tagsXml =
      (q.tags ?? []).length > 0
        ? `\n    <tags>\n${q.tags.map((t) => `      <tag><text>${escapeXml(t)}</text></tag>`).join("\n")}\n    </tags>`
        : "";

    // <name> é o campo correto do padrão Moodle (não <n>)
    const nameText = escapeXml(
      `${q.category || "Sem disciplina"} - ${stripHtml(q.statement).slice(0, 60)}…`,
    );

    return `
  <question type="multichoice">
    <name>
      <text>${nameText}</text>
    </name>
    <questiontext format="html">
      <text><![CDATA[${q.statement}]]></text>
    </questiontext>
    <generalfeedback format="html">
      <text></text>
    </generalfeedback>
    <defaultgrade>1</defaultgrade>
    <penalty>0.3333333</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answernumbering>abc</answernumbering>
    <showstandardinstruction>0</showstandardinstruction>
    <correctfeedback format="html">
      <text>Sua resposta está correta.</text>
    </correctfeedback>
    <partiallycorrectfeedback format="html">
      <text>Sua resposta está parcialmente correta.</text>
    </partiallycorrectfeedback>
    <incorrectfeedback format="html">
      <text>Sua resposta está incorreta.</text>
    </incorrectfeedback>
    <shownumcorrect/>${answersXml}${tagsXml}
  </question>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
${questionsXml.join("\n")}
</quiz>`;
}

// ─────────────────────────────────────────────
// IMPORTAR MOODLE XML
// ─────────────────────────────────────────────

export function importFromMoodleXml(
  xmlContent: string,
): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  // 1. Parsear o XML
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlContent, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      return {
        success: false,
        questions: [],
        errors: [
          "O arquivo XML está malformado. Verifique se foi exportado corretamente do Moodle.",
        ],
        warnings: [],
      };
    }
  } catch {
    return {
      success: false,
      questions: [],
      errors: ["Não foi possível processar o arquivo XML."],
      warnings: [],
    };
  }

  // 2. Selecionar questões de múltipla escolha
  const questionNodes = doc.querySelectorAll(
    'question[type="multichoice"]',
  );

  if (questionNodes.length === 0) {
    return {
      success: false,
      questions: [],
      errors: [
        "Nenhuma questão de múltipla escolha encontrada. " +
          'Certifique-se de exportar questões do tipo "Multiple Choice" do Moodle.',
      ],
      warnings: [],
    };
  }

  questionNodes.forEach((node, index) => {
    try {
      // ── Enunciado ──────────────────────────────────────────────────
      // O Moodle envolve o enunciado em HTML dentro de CDATA.
      // Mantemos o HTML pois o sistema o renderiza com dangerouslySetInnerHTML.
      const statementRaw =
        node
          .querySelector("questiontext text")
          ?.textContent?.trim() ?? "";

      // Verificamos se há conteúdo visível (e não apenas tags HTML vazias)
      if (!stripHtml(statementRaw)) {
        warnings.push(
          `Questão ${index + 1}: enunciado vazio — será ignorada.`,
        );
        return;
      }
      const statement = statementRaw; // preserva HTML

      // ── Alternativas ───────────────────────────────────────────────
      // CORREÇÃO CRÍTICA: o Moodle envolve as alternativas em <p dir="ltr">…</p>
      // dentro de CDATA. Como as opções são exibidas como texto simples no sistema,
      // precisamos remover o HTML para evitar que as tags apareçam na tela.
      const answerNodes = node.querySelectorAll("answer");
      const options: string[] = [];
      let correctOption = 0;
      let optionIndex = 0;

      answerNodes.forEach((answer) => {
        // Pega apenas o <text> direto do <answer> (não o do <feedback>)
        const textEl =
          answer.querySelector(":scope > text") ??
          answer.querySelector("text");
        const rawText = textEl?.textContent?.trim() ?? "";
        const text = stripHtml(rawText); // ← remove HTML das alternativas
        const fraction = parseFloat(
          answer.getAttribute("fraction") ?? "0",
        );

        if (text) {
          options.push(text);
          if (fraction > 0) {
            correctOption = optionIndex; // índice real dentro de options[]
          }
          optionIndex++;
        }
      });

      if (options.length < 2) {
        warnings.push(
          `Questão ${index + 1}: menos de 2 alternativas válidas encontradas — será ignorada.`,
        );
        return;
      }

      // ── Tags ────────────────────────────────────────────────────────
      const tags: string[] = Array.from(
        node.querySelectorAll("tags tag text"),
      )
        .map((t) => t.textContent?.trim() ?? "")
        .filter(Boolean);

      // ── Disciplina / Categoria ──────────────────────────────────────
      // • XML gerado por este sistema: "<Disciplina> - Questão N"
      // • XML nativo do Moodle:        título livre (sem separador)
      const nameText =
        node.querySelector("name text")?.textContent?.trim() ??
        "";
      const categoryFromName = nameText.includes(" - ")
        ? nameText.split(" - ")[0].trim()
        : "";
      const category =
        categoryFromName || tags[0] || "Importada do Moodle";

      questions.push({
        statement,
        options,
        correctOption,
        category,
        tags,
      });
    } catch {
      warnings.push(
        `Questão ${index + 1}: erro inesperado ao processar — será ignorada.`,
      );
    }
  });

  if (questions.length === 0) {
    return {
      success: false,
      questions: [],
      errors: ["Nenhuma questão válida encontrada no arquivo."],
      warnings,
    };
  }

  return { success: true, questions, errors, warnings };
}

// ─────────────────────────────────────────────
// IMPORTAR CSV (formato exportado por este sistema)
// ─────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

export function importFromCsv(
  csvContent: string,
): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  const lines = csvContent
    .replace(/^\uFEFF/, "") // remove BOM
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());

  if (lines.length < 2) {
    return {
      success: false,
      questions: [],
      errors: [
        "Arquivo CSV vazio ou sem linhas de dados (além do cabeçalho).",
      ],
      warnings: [],
    };
  }

  // Colunas esperadas: ID, Professor, Disciplina, Tags, Enunciado, A, B, C, D, E, Resposta, Data
  const dataLines = lines.slice(1);

  dataLines.forEach((line, lineIndex) => {
    const cols = parseCSVLine(line);
    if (cols.length < 10) {
      warnings.push(
        `Linha ${lineIndex + 2}: colunas insuficientes (${cols.length}/10) — será ignorada.`,
      );
      return;
    }

    const clean = (v: string) =>
      (v ?? "").replace(/^"|"$/g, "").trim();

    const category = clean(cols[2]) || "Importada";
    const tagsRaw = clean(cols[3]);
    const statement = clean(cols[4]);
    const optA = clean(cols[5]);
    const optB = clean(cols[6]);
    const optC = clean(cols[7]);
    const optD = clean(cols[8]);
    const optE = clean(cols[9]);
    const correctRaw = clean(cols[10]).toUpperCase();

    if (!statement) {
      warnings.push(
        `Linha ${lineIndex + 2}: enunciado vazio — será ignorada.`,
      );
      return;
    }

    const correctMap: Record<string, number> = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
      E: 4,
    };
    const correctOption = correctMap[correctRaw] ?? 0;
    const tags = tagsRaw
      ? tagsRaw
          .split(";")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const options = [optA, optB, optC, optD, optE].filter(
      Boolean,
    );

    if (options.length < 2) {
      warnings.push(
        `Linha ${lineIndex + 2}: menos de 2 alternativas válidas — será ignorada.`,
      );
      return;
    }

    questions.push({
      statement,
      options,
      correctOption,
      category,
      tags,
    });
  });

  if (questions.length === 0) {
    return {
      success: false,
      questions: [],
      errors: [
        "Nenhuma questão válida encontrada no arquivo CSV.",
      ],
      warnings,
    };
  }

  return { success: true, questions, errors, warnings };
}