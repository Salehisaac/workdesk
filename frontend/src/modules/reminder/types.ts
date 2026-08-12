/**
 * Reminders — «یادآور». The one WorkDesk module that belongs to a person rather
 * than a project: creating one sends it to the owner's direct chat with the bot,
 * which is the whole reason a reminder is worth having inside a messenger.
 */
export interface Reminder {
  id: string;
  title: string;
  note: string | null;
  /** ISO 8601 — when it's meant to go off. */
  remindAt: string | null;
  /**
   * When the "saved it" confirmation reached the user's chat. Null means that
   * message didn't go out — the reminder is still saved and will still fire.
   */
  confirmedAt: string | null;
  /**
   * When the reminder itself fired at remindAt. Null until then; it's also the
   * dispatcher's "already sent" guard, which is why it's separate from
   * confirmedAt rather than one shared flag.
   */
  notifiedAt: string | null;
  createdAt: string;
}

export interface CreateReminderInput {
  title: string;
  note?: string;
  /**
   * RFC 3339 carrying this device's UTC offset (see toLocalIso) — the backend
   * formats the Persian date from it, so the offset has to survive the trip.
   */
  remindAt: string;
}
