import { describe, it, expect } from 'vitest';
import { getMediaFromWarehouse, groupImagesByClassification } from '../mediaUtils';

const urls = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'];
const labelled = {
  'a.jpg': { classification: 'INDOOR' },
  'b.jpg': { classification: 'OUTDOOR' },
  'c.jpg': { classification: 'DOCUMENT' },
  'd.jpg': { classification: 'INDOOR' },
};

describe('getMediaFromWarehouse', () => {
  it('prefers the media column', () => {
    expect(getMediaFromWarehouse({ media: { images: ['x'], videos: [], docs: [] } }).images).toEqual(['x']);
  });

  it('falls back to the legacy photos CSV', () => {
    expect(getMediaFromWarehouse({ photos: 'x.jpg, y.jpg' }).images).toEqual(['x.jpg', 'y.jpg']);
  });

  it('returns empty shape when there is nothing', () => {
    expect(getMediaFromWarehouse({})).toEqual({ images: [], videos: [], docs: [] });
  });
});

describe('groupImagesByClassification', () => {
  it('splits into sections in display order, preserving media order within each', () => {
    const sections = groupImagesByClassification(urls, labelled);

    expect(sections.map((s) => s.key)).toEqual(['INDOOR', 'OUTDOOR', 'DOCUMENT']);
    expect(sections[0].urls).toEqual(['a.jpg', 'd.jpg']);
    expect(sections[1].urls).toEqual(['b.jpg']);
  });

  it('never drops an image — every url lands in exactly one section', () => {
    const sections = groupImagesByClassification(urls, labelled);
    const flat = sections.flatMap((s) => s.urls);

    expect(flat.sort()).toEqual([...urls].sort());
    expect(new Set(flat).size).toBe(urls.length);
  });

  it('puts unlabelled and UNKNOWN images in Other rather than hiding them', () => {
    const sections = groupImagesByClassification(urls, {
      'a.jpg': { classification: 'INDOOR' },
      'b.jpg': { classification: 'UNKNOWN' },
      // c.jpg and d.jpg have no label at all
    });
    const other = sections.find((s) => s.key === 'OTHER');

    expect(other.urls).toEqual(['b.jpg', 'c.jpg', 'd.jpg']);
    expect(sections.flatMap((s) => s.urls)).toHaveLength(urls.length);
  });

  it('returns null with no labels, so the caller renders its plain gallery', () => {
    expect(groupImagesByClassification(urls, null)).toBeNull();
    expect(groupImagesByClassification(urls, {})).toBeNull();
    expect(groupImagesByClassification(urls, undefined)).toBeNull();
  });

  it('still returns one section when every image is the same class', () => {
    // An all-outdoor listing (a site under construction) is a real case, and
    // hiding the heading there made the feature look like it had not run.
    const sections = groupImagesByClassification(['a.jpg', 'b.jpg'], {
      'a.jpg': { classification: 'INDOOR' },
      'b.jpg': { classification: 'INDOOR' },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ key: 'INDOOR', title: 'Indoor', urls: ['a.jpg', 'b.jpg'] });
  });

  it('returns null for no images', () => {
    expect(groupImagesByClassification([], labelled)).toBeNull();
    expect(groupImagesByClassification(null, labelled)).toBeNull();
  });

  it('treats an unrecognised classification as Other rather than dropping it', () => {
    const sections = groupImagesByClassification(['a.jpg', 'b.jpg'], {
      'a.jpg': { classification: 'INDOOR' },
      'b.jpg': { classification: 'SOMETHING_NEW' },
    });

    expect(sections.find((s) => s.key === 'OTHER').urls).toEqual(['b.jpg']);
  });
});
