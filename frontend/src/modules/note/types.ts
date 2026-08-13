/**
 * Notes module — «یادداشت‌ها». The smallest thing WorkDesk stores: a title, some
 * text, and the day it was written on.
 *
 * That day is not a field the writer picks. A note can only be written for the
 * current day — the backend rejects any other (`POST /notes`, see
 * NoteController.Store) — which is why there is no `date` on the note itself:
 * `createdAt` is the day, and nothing can move it afterwards.
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

export interface CreateNoteInput {
  title: string;
  body?: string;
  /** Omitted for a personal note, which is the common case. */
  projectId?: string;
  /**
   * RFC 3339 carrying this device's UTC offset (see toLocalIso) — the day the
   * client believes it's writing on. The backend checks it against its own
   * clock and refuses anything but today, so a form left open past midnight
   * says so instead of quietly filing under the wrong day.
   */
  date: string;
}
