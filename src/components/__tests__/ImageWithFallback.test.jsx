import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Image } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import ImageWithFallback from '../ImageWithFallback';
import { getMediaFromWarehouse, imageVariant } from '../../utils/mediaUtils';

describe('explicit image pairs', () => {
  it('also switches the actual Ant Design gallery image back to its original', async () => {
    render(<ImageWithFallback as={Image} alt="Gallery" preview={false}
      originalUrl="https://fixture.test/original.jpg" variantUrl="https://fixture.test/jpeg/variant.jpg" />);
    const image = screen.getByAltText('Gallery');
    fireEvent.error(image);
    await waitFor(() => expect(image).toHaveAttribute('src', 'https://fixture.test/original.jpg'));
  });
  it('falls back once to the original regardless of filename and accepts a new variant', () => {
    const originalUrl = 'https://fixture.test/photo.jpg';
    const jpegUrl = 'https://fixture.test/jpeg/images/hash/variant.jpg';
    const failed = vi.fn();
    const view = render(<ImageWithFallback alt="Photo" originalUrl={originalUrl} variantUrl={jpegUrl} onError={failed} />);
    const image = screen.getByAltText('Photo');
    expect(image).toHaveAttribute('src', jpegUrl);
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', originalUrl);
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', originalUrl);
    expect(failed).toHaveBeenCalledTimes(1);
    view.rerender(<ImageWithFallback alt="Photo" originalUrl={originalUrl} variantUrl={`${jpegUrl}?v=2`} />);
    expect(image).toHaveAttribute('src', `${jpegUrl}?v=2`);
  });
  it('keeps original identities and explicit empty media, including serialized media', () => {
    const originalUrl = 'https://fixture.test/plan.jpg';
    const rows = [{ originalUrl, jpegUrl: 'https://fixture.test/jpeg/encoded.jpg' }];
    expect(imageVariant(rows, originalUrl)).toBe(rows[0].jpegUrl);
    expect(getMediaFromWarehouse({ media: JSON.stringify({ images: [] }), photos: originalUrl }).images).toEqual([]);
    expect(getMediaFromWarehouse({ media: { images: [originalUrl] }, images: rows }).images).toEqual([originalUrl]);
  });

  it('defaults to JPEG while allowing an explicit WebP preview', () => {
    const originalUrl = 'https://fixture.test/original.jpg';
    const webpUrl = 'https://fixture.test/gallery.webp';
    const jpegUrl = 'https://fixture.test/ppt.jpg';
    const rows = [{ originalUrl, webpUrl, jpegUrl }];
    expect(imageVariant(rows, originalUrl)).toBe(jpegUrl);
    expect(imageVariant(rows, originalUrl, 'webp')).toBe(webpUrl);
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

  it.each([undefined, [], [{ originalUrl: 'https://fixture.test/photo.jpg', webpUrl: 'https://fixture.test/photo.webp' }]])(
    'uses the original without retries when the JPEG pair is missing (%j)', images => {
      const originalUrl = 'https://fixture.test/photo.jpg';
      const onError = vi.fn(), onFallback = vi.fn();
      render(<ImageWithFallback alt="Missing variant" originalUrl={originalUrl}
        variantUrl={imageVariant(images, originalUrl)} onError={onError} onFallback={onFallback} />);
      const image = screen.getByAltText('Missing variant');
      expect(image).toHaveAttribute('src', originalUrl);
      fireEvent.error(image);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onFallback).not.toHaveBeenCalled();
    },
  );
});
