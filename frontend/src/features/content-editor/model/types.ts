import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Post } from "@/entities/post";

export type Modal = {
  kind: "group" | "join" | "post" | "event" | "memo" | "pdf" | "documentEdit";
  initialDate?: string;
  item?: Post | Event | Document;
};
