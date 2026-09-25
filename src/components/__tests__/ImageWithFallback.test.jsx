import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Image } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import ImageWithFallback from '../ImageWithFallback';
import { getMediaFromWarehouse, imageVariant } from '../../utils/mediaUtils';

describe('explicit WebP image pairs', () => {
  it('also switches the actual Ant Design gallery image back to its original', async () => {
    render(<ImageWithFallback as={Image} alt="Gallery" preview={false}
      originalUrl="https://fixture.test/original.jpg" webpUrl="https://fixture.test/variant.webp" />);
    const image = screen.getByAltText('Gallery');
    fireEvent.error(image);
    await waitFor(() => expect(image).toHaveAttribute('src', 'https://fixture.test/original.jpg'));
  });
  it('falls back once to the original regardless of filename and accepts a new variant', () => {
    const originalUrl = 'https://fixture.test/photo.jpg';
    const webpUrl = 'https://fixture.test/webp/images/hash/variant.webp';
    const failed = vi.fn();
    const view = render(<ImageWithFallback alt="Photo" originalUrl={originalUrl} webpUrl={webpUrl} onError={failed} />);
    const image = screen.getByAltText('Photo');
    expect(image).toHaveAttribute('src', webpUrl);
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', originalUrl);
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', originalUrl);
    expect(failed).toHaveBeenCalledTimes(1);
    view.rerender(<ImageWithFallback alt="Photo" originalUrl={originalUrl} webpUrl={`${webpUrl}?v=2`} />);
    expect(image).toHaveAttribute('src', `${webpUrl}?v=2`);
  });
  it('keeps original identities and explicit empty media, including serialized media', () => {
    const originalUrl = 'https://fixture.test/plan.jpg';
    const rows = [{ originalUrl, webpUrl: 'https://fixture.test/encoded.webp' }];
    expect(imageVariant(rows, originalUrl)).toBe(rows[0].webpUrl);
    expect(getMediaFromWarehouse({ media: JSON.stringify({ images: [] }), photos: originalUrl }).images).toEqual([]);
    expect(getMediaFromWarehouse({ media: { images: [originalUrl] }, images: rows }).images).toEqual([originalUrl]);
  });

  it('selects JPEG explicitly while preserving the gallery WebP default', () => {
    const originalUrl = 'https://fixture.test/original.jpg';
    const webpUrl = 'https://fixture.test/gallery.webp';
    const jpegUrl = 'https://fixture.test/ppt.jpg';
    const rows = [{ originalUrl, webpUrl, jpegUrl }];
    expect(imageVariant(rows, originalUrl)).toBe(webpUrl);
    expect(imageVariant(rows, originalUrl, 'jpeg')).toBe(jpegUrl);
    const fallback = vi.fn();
    const view = render(<ImageWithFallback alt="Photo" originalUrl={originalUrl} webpUrl={webpUrl}
      variantUrl={jpegUrl} onFallback={fallback} />);
    const image = screen.getByAltText('Photo');
    expect(image).toHaveAttribute('src', jpegUrl);
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', originalUrl);
    expect(fallback).toHaveBeenCalledTimes(1);
    view.rerender(<ImageWithFallback alt="Photo" originalUrl={originalUrl} webpUrl={webpUrl} variantUrl={null} />);
    expect(image).toHaveAttribute('src', originalUrl);
    view.rerender(<ImageWithFallback alt="Photo" originalUrl={originalUrl} webpUrl={webpUrl} />);
    expect(image).toHaveAttribute('src', webpUrl);
  });
});
