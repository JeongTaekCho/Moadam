import type { Document } from "@/entities/document";
import type { Event } from "@/entities/event";
import type { Comment, Post } from "@/entities/post";

export type Modal = {
  kind:
    | "group"
    | "join"
    | "post"
    | "event"
    | "memo"
    | "pdf"
    | "comment"
    | "documentEdit";
  item?: Post | Event | Comment | Document;
};
