/**
 * A dot under a day. Deliberately generic — the calendar knows nothing about
 * sessions or projects, callers decide what a marker means and what colour it
 * gets (see HomePage, which derives them from the agenda).
 */
export interface CalendarMarker {
  /** Stable within a day; used as the React key. */
  id: string;
  /** Any CSS colour, including a custom property. */
  color: string;
  /** Read out as part of the day's aria-label — dots alone aren't accessible. */
  label: string;
}
