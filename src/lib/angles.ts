import type { Profile } from '../data/types';

/**
 * Reads what the user typed in "What is this content about?".
 *
 * People type two kinds of things there: a subject ("cooking rendang with
 * Adabi paste") or an intent ("Product USP", "new product", "Raya promo").
 * Pasting an intent straight into a hook reads badly ("Top 3 things to know
 * about Product USP"), so recognised intents get their own subjects and hooks,
 * and the key points are worked into those hooks.
 *
 * Templates here may use, besides the profile placeholders:
 *   {object}    the typed text with the intent words removed (falls back per angle)
 *   {focus}     the text exactly as typed
 *   {points}    the key points as a list ("A, B and C")
 *   {point1}    the first key point
 *   {count}     how many key points there are (hooks using it need 2+)
 *   {checklist} "A ✓ B ✓ C ✓"
 */

type Lang = 'en' | 'ms';
type Texts = Record<Lang, string[]>;

interface Angle {
  id: string;
  label: Record<Lang, string>;
  /** Phrases that signal this intent. Longest first wins when stripping. */
  keywords: string[];
  /** Extra words that only make sense with this intent and are stripped from the object. */
  strip?: string[];
  /** Use the text as typed instead of the stripped object. */
  useFocus?: boolean;
  /** What {object} becomes when nothing is left after stripping. */
  fallback: Record<Lang, string>;
  subjects: Texts;
  hooks: Texts;
  /** Hooks that need at least one key point. */
  pointHooks?: Texts;
}

/** Checked in this order; the first match wins. */
const ANGLES: Angle[] = [
  {
    id: 'promo',
    label: { en: 'Promo / offer', ms: 'Promosi / tawaran' },
    keywords: ['promo', 'promotion', 'promosi', 'sale', 'jualan murah', 'discount', 'diskaun', 'offer', 'tawaran', 'deal', 'deals', 'bundle', 'voucher', 'rebate', 'cashback', 'clearance', 'free gift', 'percuma'],
    useFocus: true,
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['our {focus}', 'this {focus}'], ms: ['{focus} kami', '{focus} ini'] },
    hooks: {
      en: ["Don't miss our {focus}. It won't last", 'Our {focus} is on now'],
      ms: ['Jangan lepaskan {focus} kami. Tak lama ni', '{focus} kami dah bermula'],
    },
    pointHooks: { en: ['Our {focus}: {points}.'], ms: ['{focus} kami: {points}.'] },
  },
  {
    id: 'launch',
    label: { en: 'New product / launch', ms: 'Produk baharu / pelancaran' },
    keywords: ['coming soon', 'introducing', 'memperkenalkan', 'launching', 'launch', 'pelancaran', 'lancar', 'terbaru', 'baharu', 'baru', 'new', 'latest'],
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['our new {object}', 'the brand-new {object}'], ms: ['{object} baharu kami', '{object} yang serba baharu'] },
    hooks: {
      en: ["It's finally here: the new {object}", 'Meet the newest {object} from {brand}'],
      ms: ['Akhirnya sampai: {object} baharu', 'Kenali {object} terbaru daripada {brand}'],
    },
    pointHooks: { en: ['New {object}: {points}.', '{checklist} Meet the new {object}.'], ms: ['{object} baharu: {points}.', '{checklist} Kenali {object} baharu.'] },
  },
  {
    id: 'review',
    label: { en: 'Reviews / testimonials', ms: 'Review / testimoni' },
    keywords: ['testimonials', 'testimonial', 'testimoni', 'reviews', 'review', 'feedback', 'ulasan', 'maklum balas'],
    strip: ['customers', 'customer', 'pelanggan'],
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['what customers really think of {object}', 'real reviews of {object}'], ms: ['apa pelanggan betul-betul rasa tentang {object}', 'review sebenar {object}'] },
    hooks: {
      en: ["We asked our customers about {object}. Here's what they said", 'Real customers, honest reviews: {object}'],
      ms: ['Kami tanya pelanggan tentang {object}. Ini jawapan mereka', 'Pelanggan sebenar, review jujur: {object}'],
    },
    pointHooks: { en: ['Customers keep saying the same thing about {object}: {point1}'], ms: ['Pelanggan asyik cakap benda sama tentang {object}: {point1}'] },
  },
  {
    id: 'event',
    label: { en: 'Event', ms: 'Event / majlis' },
    keywords: ['open house', 'rumah terbuka', 'roadshow', 'workshop', 'bengkel', 'festival', 'pameran', 'bazaar', 'bazar', 'booth', 'expo', 'event', 'majlis'],
    useFocus: true,
    fallback: { en: '{brand}', ms: '{brand}' },
    subjects: { en: ['our {focus}', "what's happening at our {focus}"], ms: ['{focus} kami', 'apa yang berlaku di {focus} kami'] },
    hooks: {
      en: ["You're invited: our {focus}", 'Save the date for our {focus}'],
      ms: ['Anda dijemput: {focus} kami', 'Tandakan tarikh untuk {focus} kami'],
    },
    pointHooks: { en: ['Our {focus}: {points}. See you there'], ms: ['{focus} kami: {points}. Jumpa di sana'] },
  },
  {
    id: 'comparison',
    label: { en: 'Comparison', ms: 'Perbandingan' },
    keywords: ['comparison', 'compare', 'perbandingan', 'banding', 'versus', 'difference', 'beza', 'vs'],
    useFocus: true,
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['{focus}'], ms: ['{focus}'] },
    hooks: {
      en: ['{focus}: which one wins?', "I tested {focus} so you don't have to"],
      ms: ['{focus}: mana satu menang?', 'Saya dah uji {focus}, jadi anda tak perlu'],
    },
  },
  {
    id: 'usp',
    label: { en: 'USP / why choose us', ms: 'USP / kenapa pilih kami' },
    keywords: ['unique selling points', 'unique selling point', 'why choose', 'kenapa pilih', 'keistimewaan', 'kelebihan', 'istimewa', 'advantages', 'advantage', 'benefits', 'benefit', 'manfaat', 'features', 'feature', 'ciri-ciri', 'ciri', 'usps', 'usp'],
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['what makes {object} different', 'why {audience} choose {object}'], ms: ['apa yang buat {object} berbeza', 'kenapa {audience} pilih {object}'] },
    hooks: {
      en: ["Not all {niche} brands are the same. Here's what makes {object} different", 'The real reason {audience} choose {object}'],
      ms: ['Bukan semua jenama {niche} sama. Ini yang buat {object} berbeza', 'Sebab sebenar {audience} pilih {object}'],
    },
    pointHooks: {
      en: ["{checklist} That's {object}.", '{count} reasons {audience} choose {object}: {points}', 'What makes {object} different? {point1}, for a start.'],
      ms: ['{checklist} Itulah {object}.', '{count} sebab {audience} pilih {object}: {points}', 'Apa yang buat {object} berbeza? {point1}, sebagai permulaan.'],
    },
  },
  {
    id: 'tips',
    label: { en: 'Tips', ms: 'Tips' },
    keywords: ['tips', 'tip', 'hacks', 'hack', 'petua', 'tricks', 'trick'],
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['tips for {object}', 'the smartest way to handle {object}'], ms: ['tips untuk {object}', 'cara paling bijak untuk {object}'] },
    hooks: {
      en: ['Tips nobody tells you about {object}', 'Save these tips for {object}'],
      ms: ['Tips yang tiada siapa beritahu tentang {object}', 'Save tips ni untuk {object}'],
    },
    pointHooks: { en: ['{count} tips for {object}: {points}'], ms: ['{count} tips untuk {object}: {points}'] },
  },
  {
    id: 'faq',
    label: { en: 'FAQ', ms: 'Soalan lazim' },
    keywords: ['faqs', 'faq', 'questions', 'question', 'soalan', 'tanya'],
    fallback: { en: '{product}', ms: '{product}' },
    subjects: { en: ['your questions about {object}', 'the questions we always get about {object}'], ms: ['soalan anda tentang {object}', 'soalan yang kami selalu dapat tentang {object}'] },
    hooks: {
      en: ['You asked, we answered: {object}', 'The question everyone asks about {object}'],
      ms: ['Anda tanya, kami jawab: {object}', 'Soalan yang semua orang tanya tentang {object}'],
    },
  },
  {
    id: 'bts',
    label: { en: 'Behind the scenes', ms: 'Di sebalik tabir' },
    keywords: ['behind the scenes', 'behind-the-scenes', 'di sebalik tabir', 'belakang tabir', "how it's made", 'how it is made', 'process', 'proses', 'factory', 'kilang', 'bts'],
    fallback: { en: '{brand}', ms: '{brand}' },
    subjects: { en: ['what happens behind the scenes at {object}', 'how {object} really works'], ms: ['apa yang berlaku di sebalik tabir {object}', 'bagaimana {object} sebenarnya berjalan'] },
    hooks: {
      en: ['Come behind the scenes at {object}', "You've never seen this side of {object}"],
      ms: ['Jom ke belakang tabir {object}', 'Anda tak pernah tengok sisi {object} ini'],
    },
  },
  {
    id: 'story',
    label: { en: 'Brand story', ms: 'Kisah jenama' },
    keywords: ['story', 'kisah', 'cerita', 'journey', 'perjalanan', 'founder', 'pengasas'],
    fallback: { en: '{brand}', ms: '{brand}' },
    subjects: { en: ['the story behind {object}', 'how {object} started'], ms: ['kisah di sebalik {object}', 'macam mana {object} bermula'] },
    hooks: {
      en: ['This is how {object} started', 'The story nobody knows about {object}'],
      ms: ['Beginilah {object} bermula', 'Kisah yang tiada siapa tahu tentang {object}'],
    },
  },
  {
    id: 'recipe',
    label: { en: 'Recipe / how to cook', ms: 'Resipi / cara masak' },
    keywords: ['how to cook', 'how to make', 'cara masak', 'cara buat', 'recipes', 'recipe', 'resipi', 'cooking', 'cook', 'memasak', 'masak'],
    fallback: { en: 'this dish', ms: 'hidangan ini' },
    subjects: { en: ['cooking {object}', 'making {object} at home'], ms: ['masak {object}', 'buat {object} di rumah'] },
    hooks: {
      en: ['The easiest way to cook {object}', 'Cook {object} with me, start to finish', 'Save this {object} recipe for later'],
      ms: ['Cara paling mudah masak {object}', 'Jom masak {object} dengan saya, dari mula sampai siap', 'Save resipi {object} ni untuk nanti'],
    },
    pointHooks: { en: ['{object}, the easy way: {points}'], ms: ['{object} cara mudah: {points}'] },
  },
];

/** Words that carry no subject on their own, trimmed from the ends of the object. */
const FILLERS = [
  'about', 'on', 'for', 'of', 'the', 'our', 'my', 'a', 'an', 'at', 'in', 'to', 'and', 'this', 'its', 'their',
  'tentang', 'untuk', 'kami', 'saya', 'pasal', 'mengenai', 'di', 'ini', 'itu', 'dan', 'yang', 'kita',
  'product', 'products', 'produk', 'service', 'services', 'servis', 'perkhidmatan', 'item', 'items', 'video', 'content', 'kandungan',
];

export interface FocusReading {
  /** The recognised intent, when there is one. */
  angle?: { id: string; label: string };
  /** Replace the topic subjects in hooks. Profile placeholders are left in. */
  subjects: string[];
  /** Added to the hook pool. Profile placeholders are left in. */
  hooks: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrase = (words: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(words)}(?=$|[^\\p{L}\\p{N}])`, 'iu');

export function cleanPoint(text: string): string {
  return text.trim().replace(/[.;,!]+$/, '');
}

function joinList(items: string[], lang: Lang): string {
  if (items.length <= 1) return items[0] ?? '';
  const and = lang === 'ms' ? 'dan' : 'and';
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

function stripObject(focus: string, angle: Angle): string {
  let text = ` ${focus} `;
  const words = [...angle.keywords, ...(angle.strip ?? [])].sort((a, b) => b.length - a.length);
  for (const word of words) {
    const re = new RegExp(phrase(word).source, 'giu');
    text = text.replace(re, '$1 ');
  }
  text = text.replace(/\s+/g, ' ').trim();
  // Trim filler words and stray punctuation from both ends until nothing changes.
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/^[\s:;,.\-–—'"&+]+|[\s:;,.\-–—'"&+]+$/g, '');
    const parts = text.split(' ');
    const isFiller = (word: string) => FILLERS.includes(word.toLowerCase().replace(/[:;,.\-–—]+$/, ''));
    while (parts.length && isFiller(parts[0])) parts.shift();
    while (parts.length && isFiller(parts[parts.length - 1])) parts.pop();
    text = parts.join(' ');
  }
  return text;
}

/**
 * Turn "What is this content about?" and the key points into hook subjects and extra hooks.
 * Returns undefined when nothing was typed.
 */
export function readFocus(focus: string, points: string[], language: Profile['language']): FocusReading | undefined {
  const typed = focus.trim();
  if (!typed) return undefined;
  const lang: Lang = language === 'English' ? 'en' : 'ms';

  const angle = ANGLES.find((a) => a.keywords.some((k) => phrase(k).test(typed)));
  if (!angle) return { subjects: [typed], hooks: [] };

  const object = (angle.useFocus ? typed : stripObject(typed, angle)) || angle.fallback[lang];
  const cleaned = points.map(cleanPoint).filter(Boolean);
  const fill = (template: string) =>
    template
      .replaceAll('{object}', object)
      .replaceAll('{focus}', typed)
      .replaceAll('{points}', joinList(cleaned, lang))
      .replaceAll('{point1}', cleaned[0] ?? '')
      .replaceAll('{count}', String(cleaned.length))
      .replaceAll('{checklist}', cleaned.map((p) => `${p} ✓`).join(' '));

  const pointHooks = (angle.pointHooks?.[lang] ?? []).filter((h) => cleaned.length >= (h.includes('{count}') ? 2 : 1));
  return {
    angle: { id: angle.id, label: angle.label[lang] },
    subjects: angle.subjects[lang].map(fill),
    hooks: [...angle.hooks[lang], ...(cleaned.length ? pointHooks : [])].map(fill),
  };
}
