// A tag with no colour still has to render as a coloured chip, and it has to
// render as the *same* colour everywhere it appears. Deriving it from the name
// gives that for free — no extra state, no round-trip — and the palette is
// muted enough that white text stays readable on every entry.
const TAG_COLORS = ['#8b5cf6', '#0891b2', '#b45309', '#be185d', '#15803d', '#4338ca', '#b91c1c', '#0f766e'];

export function tagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}
