export const emptyMedia = () => ({ images: [], videos: [], docs: [] });
export const mediaKinds = ['images', 'videos', 'docs'];
export const mediaFileName = url => {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'File'; } catch { return 'File'; }
};
