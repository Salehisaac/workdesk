/**
 * Notes module — «یادداشت‌ها». Same status as the meetings module: the shape is
 * settled, the backend route isn't there yet. See modules/meeting/types.ts.
 */
export interface Note {
  id: string;
  title: string;
  /** Plain-text preview of the body — the list never renders the full note. */
  excerpt: string | null;
  /** The project it's filed under, when it's filed under one. */
  projectId: string | null;
  projectName: string | null;
  /** ISO 8601. A note belongs to the calendar day it was written on. */
  createdAt: string;
}
