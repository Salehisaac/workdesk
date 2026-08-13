/**
 * Monogram avatars — the picture a project gets when nobody uploads one.
 *
 * A project's avatar is not decoration here: the backend hands it to the admin
 * API as the photo of the Rasagram group it provisions (see
 * project_controller.go / uploadedAvatar), and a group with no photo shows up
 * in every member's chat list as a grey circle. Almost nobody stops to pick an
 * image mid-flow, so the create screen paints one instead — the project's first
 * letter over a gradient the user chose with one tap — and uploads it through
 * the same POST /uploads the file picker uses. Nothing on the server had to
 * learn about monograms: it receives an ordinary PNG.
 *
 * The same palette drives the on-screen preview (as a CSS gradient) and the
 * uploaded file (painted on a canvas), so what the user picks is what the group
 * ends up wearing.
 */

export interface MonogramPalette {
  key: string;
  /** Names the colour for the swatch's accessible label — never rendered as text. */
  label: string;
  from: string;
  to: string;
}

/** Cyan first: it is the brand accent, so the default project looks like WorkDesk. */
export const MONOGRAM_PALETTES: MonogramPalette[] = [
  { key: 'cyan', label: 'فیروزه‌ای', from: '#22d3ee', to: '#0e7490' },
  { key: 'indigo', label: 'نیلی', from: '#818cf8', to: '#3730a3' },
  { key: 'violet', label: 'بنفش', from: '#c084fc', to: '#6d28d9' },
  { key: 'amber', label: 'کهربایی', from: '#fbbf24', to: '#b45309' },
  { key: 'rose', label: 'سرخابی', from: '#fb7185', to: '#9f1239' },
  { key: 'emerald', label: 'زمردی', from: '#34d399', to: '#047857' },
];

export const DEFAULT_PALETTE = MONOGRAM_PALETTES[0];

export function paletteByKey(key: string): MonogramPalette {
  return MONOGRAM_PALETTES.find((palette) => palette.key === key) ?? DEFAULT_PALETTE;
}

/**
 * A stable palette for something that never picked one — a member chip, say.
 * Same seed always lands on the same colour, so a person doesn't change hue
 * between renders (or between screens).
 */
export function paletteForSeed(seed: string): MonogramPalette {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return MONOGRAM_PALETTES[hash % MONOGRAM_PALETTES.length];
}

export function monogramGradient(palette: MonogramPalette): string {
  return `linear-gradient(140deg, ${palette.from} 0%, ${palette.to} 100%)`;
}

/**
 * The single character a monogram shows.
 *
 * One character, not initials: Persian is cursive, and two letters torn out of
 * two words render as disconnected stumps ("ت ط") rather than anything anyone
 * would read as a name. Array.from, not [0], so a name that starts with an
 * emoji keeps the whole code point instead of half a surrogate pair.
 */
export function monogramInitial(name: string): string {
  return Array.from(name.trim())[0] ?? '';
}

const AVATAR_SIZE = 512;

/**
 * Waits for Vazirmatn to be usable on the canvas.
 *
 * canvas fillText does not wait for webfonts the way the DOM does — it draws
 * with whatever is loaded at that instant, so a monogram painted too early
 * silently comes out in the fallback sans-serif. document.fonts.load() asks for
 * the exact size/weight the paint uses.
 */
async function fontReady(font: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(font, 'م');
    await document.fonts.ready;
  } catch {
    // Not fatal — worst case the glyph is drawn in the fallback family.
  }
}

/**
 * Paints the monogram and returns it as a file POST /uploads accepts.
 *
 * Returns null rather than throwing when there is nothing to draw or the
 * browser refuses to give up the bytes: the caller treats a missing monogram as
 * "create the project without a picture", never as a reason to fail the whole
 * creation.
 */
export async function renderMonogramFile(name: string, palette: MonogramPalette): Promise<File | null> {
  const initial = monogramInitial(name);
  if (!initial) return null;

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Corner to corner, matching monogramGradient's 140deg closely enough that
  // the preview and the uploaded file read as the same picture.
  const background = ctx.createLinearGradient(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  background.addColorStop(0, palette.from);
  background.addColorStop(1, palette.to);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

  // A soft highlight off the top corner, so the square doesn't read as a flat
  // colour swatch once a chat list crops it into a circle.
  const sheen = ctx.createRadialGradient(
    AVATAR_SIZE * 0.28,
    AVATAR_SIZE * 0.18,
    0,
    AVATAR_SIZE * 0.28,
    AVATAR_SIZE * 0.18,
    AVATAR_SIZE * 0.9,
  );
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const font = `600 ${Math.round(AVATAR_SIZE * 0.44)}px 'Vazirmatn Variable', 'Vazirmatn', sans-serif`;
  await fontReady(font);

  ctx.font = font;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, AVATAR_SIZE / 2, AVATAR_SIZE / 2);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;

  return new File([blob], 'project-monogram.png', { type: 'image/png' });
}
