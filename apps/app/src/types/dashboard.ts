import type { Id } from "@repo/convex/_generated/dataModel";

export interface Org {
  slug: string;
  name: string;
}

export interface Project {
  _id: Id<"projects">;
  name: string;
  slug?: string;
  description: string;
}

export interface Tab {
  label: string;
  href: string;
}
