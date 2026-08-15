import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import WarehouseDetailsModal from '../WarehouseDetailsModal';

// The modal reads the cache during render and fetches on a miss; stub both.
vi.mock('../../services/imageLabelService', () => ({
  imageLabelService: { getForWarehouse: vi.fn(), getCached: vi.fn(() => undefined) },
}));
import { imageLabelService } from '../../services/imageLabelService';

// Unrelated to images, and it needs an AuthProvider this test has no reason to build.
vi.mock('../VisitNotes', () => ({ default: () => null }));

const IMAGES = ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg'];

const warehouse = {
  id: 2364,
  city: 'Bengaluru',
  state: 'Karnataka',
  media: { images: IMAGES, videos: [], docs: [] },
};

const open = (w = warehouse) => render(
  <WarehouseDetailsModal visible warehouse={w} onClose={() => {}} />
);

const imageCount = () => document.querySelectorAll('.ant-image img').length;

describe('WarehouseDetailsModal image sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageLabelService.getCached.mockReturnValue(undefined);
  });

  it('segments images by classification once labels arrive', async () => {
    imageLabelService.getForWarehouse.mockResolvedValue({
      'https://cdn/a.jpg': { classification: 'INDOOR', description: 'inside' },
      'https://cdn/b.jpg': { classification: 'OUTDOOR', description: 'facade' },
      'https://cdn/c.jpg': { classification: 'INDOOR', description: 'racking' },
    });

    open();

    await waitFor(() => expect(screen.getByText('Indoor (2)')).toBeInTheDocument());
    expect(screen.getByText('Outdoor (1)')).toBeInTheDocument();
    // Every image still rendered, just regrouped.
    expect(imageCount()).toBe(IMAGES.length);
  });

  it('renders segmented on the FIRST paint when the cache is warm, with no request', () => {
    // The whole point of the cache: it is read during render, so there is no
    // flat-then-segmented reflow and no round trip. Asserted synchronously —
    // no waitFor — because it must be present on render 1.
    imageLabelService.getCached.mockReturnValue({
      'https://cdn/a.jpg': { classification: 'INDOOR' },
      'https://cdn/b.jpg': { classification: 'OUTDOOR' },
      'https://cdn/c.jpg': { classification: 'OUTDOOR' },
    });

    open();

    expect(screen.getByText('Indoor (1)')).toBeInTheDocument();
    expect(screen.getByText('Outdoor (2)')).toBeInTheDocument();
    expect(imageLabelService.getForWarehouse).not.toHaveBeenCalled();
  });

  it('uses labels delivered on the row, with no cache read and no request', () => {
    // The dashboard list asks for includeImageLabels=true, so this is the
    // common path: labels are already on the warehouse object.
    open({
      ...warehouse,
      imageLabels: {
        'https://cdn/a.jpg': { classification: 'INDOOR' },
        'https://cdn/b.jpg': { classification: 'DOCUMENT' },
        'https://cdn/c.jpg': { classification: 'INDOOR' },
      },
    });

    expect(screen.getByText('Indoor (2)')).toBeInTheDocument();
    expect(screen.getByText('Documents (1)')).toBeInTheDocument();
    expect(imageLabelService.getForWarehouse).not.toHaveBeenCalled();
  });

  it('treats a cached empty object as a real answer, not a miss', () => {
    // "This warehouse has no labels" must not trigger a fetch on every open.
    imageLabelService.getCached.mockReturnValue({});

    open();

    expect(imageCount()).toBe(IMAGES.length);
    expect(imageLabelService.getForWarehouse).not.toHaveBeenCalled();
  });

  it('does not show one warehouse labels against another', async () => {
    // The modal stays mounted and its warehouse prop swaps underneath it, so
    // fetched state is tagged with the id it belongs to.
    imageLabelService.getForWarehouse.mockResolvedValue({
      'https://cdn/a.jpg': { classification: 'INDOOR' },
      'https://cdn/b.jpg': { classification: 'OUTDOOR' },
      'https://cdn/c.jpg': { classification: 'OUTDOOR' },
    });
    const { rerender } = open();
    await waitFor(() => expect(screen.getByText('Indoor (1)')).toBeInTheDocument());

    // Swap to a different warehouse whose labels are not loaded yet.
    imageLabelService.getForWarehouse.mockReturnValue(new Promise(() => {})); // never resolves
    rerender(
      <WarehouseDetailsModal
        visible
        warehouse={{ ...warehouse, id: 9999, media: { images: ['https://cdn/z.jpg'], videos: [], docs: [] } }}
        onClose={() => {}}
      />
    );

    // Must fall back to the plain gallery, NOT reuse 2364's sections.
    expect(screen.queryByText('Indoor (1)')).not.toBeInTheDocument();
    expect(imageCount()).toBe(1);
  });

  it('skips the lookup for a staged row whose id is a uuid', () => {
    // The review queue renders this modal with a StagedWarehouse, whose id is a
    // uuid string. Requesting labels for it could only ever 400.
    open({ ...warehouse, id: '3f2b1c9e-77aa-4c11-9f0e-2a1d5b6c7d88', warehouseId: undefined });

    expect(imageCount()).toBe(IMAGES.length);
    expect(imageLabelService.getForWarehouse).not.toHaveBeenCalled();
    expect(imageLabelService.getCached).not.toHaveBeenCalledWith(expect.stringContaining('-'));
  });

  it('uses the promoted warehouseId when a staged row has one', async () => {
    imageLabelService.getForWarehouse.mockResolvedValue({
      'https://cdn/a.jpg': { classification: 'INDOOR' },
      'https://cdn/b.jpg': { classification: 'OUTDOOR' },
      'https://cdn/c.jpg': { classification: 'OUTDOOR' },
    });

    open({ ...warehouse, id: '3f2b1c9e-77aa-4c11-9f0e-2a1d5b6c7d88', warehouseId: 2364 });

    await waitFor(() => expect(screen.getByText('Indoor (1)')).toBeInTheDocument());
    expect(imageLabelService.getForWarehouse).toHaveBeenCalledWith(2364);
  });

  it('falls back to the plain gallery when the label lookup fails', async () => {
    imageLabelService.getForWarehouse.mockRejectedValue(new Error('boom'));

    open();

    // No section headings, and crucially no images lost.
    await waitFor(() => expect(imageCount()).toBe(IMAGES.length));
    expect(screen.queryByText(/^Indoor \(/)).not.toBeInTheDocument();
    expect(screen.getByText(`Images (${IMAGES.length})`)).toBeInTheDocument();
  });

  it('falls back when nothing is labelled yet', async () => {
    imageLabelService.getForWarehouse.mockResolvedValue({});

    open();

    await waitFor(() => expect(imageCount()).toBe(IMAGES.length));
    expect(screen.queryByText(/^Indoor \(/)).not.toBeInTheDocument();
  });

  it('shows a single heading when every image is the same class', async () => {
    imageLabelService.getForWarehouse.mockResolvedValue(
      Object.fromEntries(IMAGES.map((u) => [u, { classification: 'OUTDOOR' }])),
    );

    open();

    await waitFor(() => expect(screen.getByText('Outdoor (3)')).toBeInTheDocument());
    expect(imageCount()).toBe(IMAGES.length);
  });
});
