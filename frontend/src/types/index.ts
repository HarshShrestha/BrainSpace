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
