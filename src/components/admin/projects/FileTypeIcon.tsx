import { FileArchive, FileCode, FileImage, FileText, Palette, Paperclip } from "lucide-react";
import { fileKind } from "@/data/files";

const icons = {
  image: FileImage,
  document: FileText,
  design: Palette,
  code: FileCode,
  archive: FileArchive,
  other: Paperclip,
} as const;

export function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  const Icon = icons[fileKind(fileType)];
  return <Icon size={16} strokeWidth={1.75} className={className} aria-hidden="true" />;
}
