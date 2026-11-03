export type ContentType = "image" | "video" | "article" | "audio";
export interface User {
  id: string;
  username: string;
}
export interface Tag {
  _id: string;
  title: string;
}
export interface Content {
  _id: string;
  title: string;
  link: string;
  type: ContentType;
  tags: Tag[];
  createdAt: string;
  rag?: { indexedAt?: string; model?: string; sourceType?: "page" | "pasted" };
}
export interface ContentInput {
  title: string;
  link: string;
  type: ContentType;
  tags: string[];
}
export interface SharedBrain {
  username: string;
  content: Content[];
}
export interface RagStatus {
  configured: boolean;
  indexed: number;
  compatible: number;
}
export interface RagSource {
  contentId: string;
  title: string;
  link: string;
  quote: string;
  sourceType?: "page" | "pasted";
  indexedAt?: string;
}
export interface RagAnswer {
  answer: string;
  sources: RagSource[];
  abstained: boolean;
}
