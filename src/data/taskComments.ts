export type TaskComment = {
  id: string;
  taskId: string;
  projectId: string;
  authorId: string | null;
  authorLabel: string;
  body: string;
  createdAt: string;
};
