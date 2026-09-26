/** Shared by public listening modes and the private trainer's recordings. */
export const CW_ARTWORK: MediaImage[] = [192, 512].map(size => ({
  src: `/assets/branding/cw-${size}.png`,
  sizes: `${size}x${size}`,
  type: "image/png",
}));
