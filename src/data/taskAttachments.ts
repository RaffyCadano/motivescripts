export type TaskAttachment = {
  id: string;
  taskId: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  uploadedBy: string | null;
  uploadedByLabel: string;
  createdAt: string;
};
