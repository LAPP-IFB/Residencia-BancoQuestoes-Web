// ─────────────────────────────────────────────
// TIPOS DE QUESTÃO
// ─────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false' | 'essay';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Múltipla Escolha',
  true_false: 'Verdadeiro/Falso',
  essay: 'Questão Aberta',
};

/** Normaliza questões legadas (sem campo type) para multiple_choice */
export function getQuestionType(q: Pick<Question, 'type'>): QuestionType {
  return q.type ?? 'multiple_choice';
}

// ─────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────

export interface Question {
  id?: number;
  authorId: number;
  authorName: string;
  subject: string;
  category: string;
  tags: string[];
  /** Tipo de questão. undefined em dados legados = múltipla escolha */
  type?: QuestionType;
  statement: string;
  options: string[];
  correctOption: number;     // índice 0-4 para multiple_choice
  correctAnswer?: boolean;   // para true_false: true = Verdadeiro é correto
  createdAt: string;
}

export interface Subject {
  id: number;
  name: string;
  createdAt: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'professor' | 'coordenador';
}

export interface Tag {
  id: number;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}