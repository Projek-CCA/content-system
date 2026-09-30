const PATHS = {
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM8.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z',
  unlock: 'M9 10h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1V7a5 5 0 0 1 9.9-1h-2.1A3 3 0 0 0 9 7v3Z',
  info: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 8a1 1 0 0 0-1 1v6h2v-6a1 1 0 0 0-1-1Zm0-4a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 6Z',
  copy: 'M8 3h10a2 2 0 0 1 2 2v12h-2V5H8V3ZM5 7h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v11h9V9H5Z',
  sparkle: 'M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2Zm6 12 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 14ZM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7L5 15Z',
  bookmark: 'M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1Zm1 2v14.3l5-3.2 5 3.2V4H7Z',
  bookmarkFilled: 'M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1Z',
  refresh: 'M12 4a8 8 0 0 1 7.4 5H17v2h6V5h-2v2.3A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8Zm8 8a8 8 0 0 1-15.4 3H7v-2H1v6h2v-2.3A10 10 0 0 0 22 12h-2Z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z',
  image: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v9.6l4-4 5 5 3-3 4 4V6H4Zm11 1.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  play: 'M8 5.1v13.8a.8.8 0 0 0 1.2.7l11-6.9a.8.8 0 0 0 0-1.4l-11-6.9A.8.8 0 0 0 8 5.1Z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
  trash: 'M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z',
  edit: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5ZM15 7l2 2',
  up: 'M12 6l6 6-1.4 1.4-3.6-3.6V19h-2V9.8l-3.6 3.6L6 12l6-6Z',
  down: 'M12 18l-6-6 1.4-1.4 3.6 3.6V5h2v9.2l3.6-3.6L18 12l-6 6Z',
  download: 'M11 3h2v9.6l3.3-3.3 1.4 1.4-5.7 5.7-5.7-5.7 1.4-1.4 3.3 3.3V3ZM4 18h16v2H4v-2Z',
  upload: 'M11 21h2v-9.6l3.3 3.3 1.4-1.4L12 7.6l-5.7 5.7 1.4 1.4L11 11.4V21ZM4 3h16v2H4V3Z',
  search: 'M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  arrow: 'M13.2 5.3 19.9 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.1l-4.3-4.3 1.4-1.4Z',
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7 9.5 16.2Z',
  grid: 'M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm8-2h8v8h-8v-8Zm2 2v4h4v-4h-4Z',
  list: 'M4 5h2v2H4V5Zm4 0h12v2H8V5ZM4 11h2v2H4v-2Zm4 0h12v2H8v-2Zm-4 6h2v2H4v-2Zm4 0h12v2H8v-2Z',
  user: 'M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 11c4.4 0 8 2.2 8 5v2H4v-2c0-2.8 3.6-5 8-5Z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const stroke = name === 'edit';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={stroke ? 'none' : 'currentColor'}
      stroke={stroke ? 'currentColor' : 'none'}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
