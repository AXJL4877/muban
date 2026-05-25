export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
