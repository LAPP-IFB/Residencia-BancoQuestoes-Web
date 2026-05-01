export interface Question {
  id?: number;
  authorId: number;
  authorName: string;
  subject: string;
  tags: string[];
  statement: string;
  options: string[];
  correctOption: number; // 0-4
  createdAt: string;
  category: string;
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

