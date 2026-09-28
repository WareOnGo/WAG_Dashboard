import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import PptConfigModal from '../PptConfigModal';
import MobileHeader from '../MobileHeader';
import { MobileToolsProvider } from '../../contexts/MobileToolsContext';
import * as exports from '../../services/pptService';

// Real Ant Design modal flows can exceed the default 5s when the full UI suite
// starts its workers concurrently on CI.
vi.setConfig({ testTimeout: 15000 });

const { getByIds, listPocs, viewport } = vi.hoisted(() => ({
  getByIds: vi.fn(), listPocs: vi.fn(), viewport: { isMobile: false },
}));
vi.mock('../../hooks', () => ({ useViewport: () => viewport }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'test@wareongo.com', name: 'Test' }, logout: vi.fn() }),
}));
vi.mock('../../services/verifiedNumberService', () => ({ verifiedNumberService: { list: listPocs } }));
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getByIds } }));
vi.mock('../../services/pptService', () => ({
  generateDetailedPpt: vi.fn(), generatePptV2: vi.fn(), generatePptV3: vi.fn(),
  generateGodamwalePpt: vi.fn(), generateTciPpt: vi.fn(), generateLastMileExcel: vi.fn(),
}));
const photos = Array.from({ length: 5 }, (_, i) => `https://photos.test/${i}.jpg`);
const warehouses = [{ id: 1, address: 'Indore property', city: 'Indore', state: 'MP', photos: photos.join(',') }];
const modalProps = () => ({
  open: true, warehouseIds: '1', allWarehouses: warehouses,
  onCancel: vi.fn(), onGenerate: vi.fn(), generating: false,
});
const selectFormat = async (user, label = 'Last Mile (Excel)') => {
  await user.click(await screen.findByText(label));
  await user.click(screen.getByRole('button', { name: 'Next' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  viewport.isMobile = false;
  listPocs.mockResolvedValue([]);
  getByIds.mockResolvedValue(warehouses);
});

describe('Last Mile configuration', () => {
  it('displays the compressed JPEG preview but submits the original URL for export', async () => {
    const jpegUrl = 'https://photos.test/jpeg/images/hash/preview.jpg';
    const rows = [{ ...warehouses[0], media: { images: [photos[0]] },
      images: [{ originalUrl: photos[0], jpegUrl, webpUrl: 'https://photos.test/preview.webp' }] }];
    getByIds.mockResolvedValue(rows);
    const props = { ...modalProps(), allWarehouses: rows };
    const user = userEvent.setup();
    render(<PptConfigModal {...props} />);
    await selectFormat(user);
    const image = screen.getByAltText('Warehouse');
    expect(image).toHaveAttribute('src', jpegUrl);
    await user.click(image);
    await user.click(screen.getByRole('button', { name: 'Generate Excel' }));
    expect(props.onGenerate.mock.calls[0][0].selectedImages).toEqual({ 1: [photos[0]] });
  });

  it.each([false, true])('selects and submits an Excel export on mobile=%s', async (isMobile) => {
    viewport.isMobile = isMobile;
    const props = modalProps();
    const user = userEvent.setup();
    render(<PptConfigModal {...props} />);
    await selectFormat(user);
    expect(screen.getByText('Workbook Details')).toBeInTheDocument();
    expect(screen.queryByText('WareOnGo POC')).not.toBeInTheDocument();
    expect(screen.queryByText('Include rent / commercials')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Generate compressed PPT (beta)' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g., XYZ Corp')).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Nelamangala/), 'Indore - 25,000 sft');
    // Four selections are kept, and clicking a fifth cannot exceed the limit.
    for (const image of screen.getAllByAltText('Warehouse')) await user.click(image);
    expect(screen.getByText('Select up to 4 images • 4/4 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate Excel' }));
    expect(props.onGenerate).toHaveBeenCalledWith({
      pptType: 'last-mile', customDetails: { clientName: 'Last Mile', clientRequirement: 'Indore - 25,000 sft' },
      selectedImages: { 1: photos.slice(0, 4) },
    });
  });

  it('allows replacing or clearing the selected photo', async () => {
    const props = modalProps();
    const user = userEvent.setup();
    render(<PptConfigModal {...props} />);
    await selectFormat(user);
    const images = screen.getAllByAltText('Warehouse');
    await user.click(images[0]);
    await user.click(images[0]);
    await user.click(images[1]);
    await user.click(screen.getByRole('button', { name: 'Generate Excel' }));
    expect(props.onGenerate.mock.calls[0][0].selectedImages).toEqual({ 1: [photos[1]] });
  });

  it('allows replacing a photo after reaching the four-image limit', async () => {
    const props = modalProps();
    const user = userEvent.setup();
    render(<PptConfigModal {...props} />);
    await selectFormat(user);
    const images = screen.getAllByAltText('Warehouse');
    for (const image of images.slice(0, 4)) await user.click(image);
    await user.click(images[1]);
    await user.click(images[4]);
    await user.click(screen.getByRole('button', { name: 'Generate Excel' }));
    expect(props.onGenerate.mock.calls[0][0].selectedImages).toEqual({ 1: [photos[0], photos[2], photos[3], photos[4]] });
  });

  it('shows Excel progress and prevents repeat submission', async () => {
    const props = modalProps();
    const user = userEvent.setup();
    const view = render(<PptConfigModal {...props} />);
    await selectFormat(user);
    view.rerender(<PptConfigModal {...props} generating />);
    expect(screen.getByText('Generating Excel workbook…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate Excel' })).not.toBeInTheDocument();
  });

  it.each([
    ['PPT v2 (Standard)', 'v2', 4], ['Godamwale (External)', 'godamwale', 4],
    ['TCI (External)', 'tci', 4], ['PPT V3 (beta)', 'v3', 5], ['Detailed PPT', 'detailed', 5],
  ])('preserves %s selection and photo limits after switching from Excel', async (label, type, limit) => {
    const props = modalProps();
    const user = userEvent.setup();
    render(<PptConfigModal {...props} />);
    await selectFormat(user);
    await user.click(screen.getByRole('button', { name: /Back/ }));
    await selectFormat(user, label);
    const images = screen.getAllByAltText('Warehouse');
    if (type === 'detailed') await user.click(images[4]); // First four auto-selected.
    else for (const image of images) await user.click(image);
    await user.click(screen.getByRole('button', { name: 'Generate PPT' }));
    const payload = props.onGenerate.mock.calls[0][0];
    expect(payload.pptType).toBe(type);
    expect(type === 'v3' ? payload.selectedImages[1].photos : payload.selectedImages[1]).toHaveLength(limit);
    expect(payload.customDetails.clientName).not.toBe('Last Mile');
  });
});

describe('compressed PPT configuration', () => {
  const pairedRows = () => [{ ...warehouses[0],
    images: [
      { originalUrl: photos[0], webpUrl: 'https://photos.test/compressed/0.webp', jpegUrl: 'https://photos.test/jpeg/0.jpg' },
      { originalUrl: photos[1], webpUrl: 'https://photos.test/compressed/1.webp', jpegUrl: null },
    ],
  }];

  it('uses JPEG previews automatically without a compression checkbox or toggle payload', async () => {
    const user = userEvent.setup();
    const props = { ...modalProps(), allWarehouses: pairedRows() };
    const view = render(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    expect(screen.queryByRole('checkbox', { name: /compressed PPT/i })).not.toBeInTheDocument();
    expect(screen.getAllByAltText('Warehouse')[0]).toHaveAttribute('src', 'https://photos.test/jpeg/0.jpg');
    expect(screen.getByText('Will be uncompressed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate PPT' }));
    expect(props.onGenerate.mock.calls[0][0]).not.toHaveProperty('compressedPpt');
    await user.click(screen.getByRole('button', { name: /Back/ }));
    await selectFormat(user, 'PPT v2 (Standard)');
    expect(screen.queryByRole('checkbox', { name: /compressed PPT/i })).not.toBeInTheDocument();
    view.rerender(<PptConfigModal {...props} open={false} />);
    view.rerender(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    expect(screen.queryByRole('checkbox', { name: /compressed PPT/i })).not.toBeInTheDocument();
  });

  it('marks only missing or failed JPEGs orange and always submits original identities', async () => {
    const user = userEvent.setup();
    const props = { ...modalProps(), allWarehouses: pairedRows() };
    render(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    const tiles = screen.getAllByRole('button', { name: /Photo for warehouse/ });
    expect(within(tiles[0]).queryByText('Will be uncompressed')).not.toBeInTheDocument();
    expect(within(tiles[1]).getByText('Will be uncompressed')).toHaveClass('ppt-uncompressed-badge');
    expect(within(tiles[0]).getByAltText('Warehouse')).toHaveAttribute('src', 'https://photos.test/jpeg/0.jpg');
    expect(within(tiles[1]).getByAltText('Warehouse')).toHaveAttribute('src', photos[1]);
    fireEvent.error(within(tiles[0]).getByAltText('Warehouse'));
    expect(within(tiles[0]).getByAltText('Warehouse')).toHaveAttribute('src', photos[0]);
    expect(within(tiles[0]).getByText('Will be uncompressed')).toBeInTheDocument();
    await user.click(tiles[0]);
    await user.click(tiles[1]);
    await user.click(screen.getByRole('button', { name: 'Generate PPT' }));
    expect(props.onGenerate.mock.calls[0][0]).toMatchObject({
      selectedImages: { 1: [photos[0], photos[1]] },
    });
    expect(props.onGenerate.mock.calls[0][0]).not.toHaveProperty('compressedPpt');
  });

  it('uses a verified small original JPEG without treating it as a missing variant', async () => {
    const user = userEvent.setup();
    const rows = pairedRows();
    rows[0].images[0].jpegUrl = photos[0];
    render(<PptConfigModal {...modalProps()} allWarehouses={rows} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    const tile = screen.getAllByRole('button', { name: /Photo for warehouse/ })[0];
    expect(within(tile).getByAltText('Warehouse')).toHaveAttribute('src', photos[0]);
    expect(within(tile).queryByText('Will be uncompressed')).not.toBeInTheDocument();
  });

  it('retries previously failed JPEG previews when the modal opens again', async () => {
    const user = userEvent.setup();
    const props = { ...modalProps(), allWarehouses: pairedRows() };
    const view = render(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    const tile = screen.getAllByRole('button', { name: /Photo for warehouse/ })[0];
    const image = within(tile).getByAltText('Warehouse');
    expect(image).toHaveAttribute('src', 'https://photos.test/jpeg/0.jpg');
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', photos[0]);
    expect(within(tile).getByText('Will be uncompressed')).toBeInTheDocument();
    view.rerender(<PptConfigModal {...props} open={false} />);
    view.rerender(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    const reopened = screen.getAllByRole('button', { name: /Photo for warehouse/ })[0];
    expect(within(reopened).queryByText('Will be uncompressed')).not.toBeInTheDocument();
    expect(within(reopened).getByAltText('Warehouse')).toHaveAttribute('src', 'https://photos.test/jpeg/0.jpg');
  });

  it('marks a missing JPEG layout and preserves the V3 photo/CAD split', async () => {
    const user = userEvent.setup();
    const rows = pairedRows();
    rows[0].imageLabels = {
      [photos[0]]: { classification: 'INDOOR' },
      [photos[1]]: { classification: 'DOCUMENT', documentKind: 'LAYOUT' },
    };
    const props = { ...modalProps(), allWarehouses: rows };
    render(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT V3 (beta)');
    const cad = screen.getByRole('button', { name: /CAD for warehouse/ });
    expect(cad).toHaveAttribute('aria-pressed', 'true');
    expect(within(cad).getByText('Will be uncompressed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Photo for warehouse/ }));
    await user.click(screen.getByRole('button', { name: 'Generate PPT' }));
    expect(props.onGenerate.mock.calls[0][0]).toMatchObject({
      selectedImages: { 1: { photos: [photos[0]], cad: [photos[1]] } },
    });
  });

  it('does not show PPT fallback indicators in Excel after switching formats', async () => {
    const user = userEvent.setup();
    const props = modalProps();
    render(<PptConfigModal {...props} />);
    await selectFormat(user, 'PPT v2 (Standard)');
    await user.click(screen.getByRole('button', { name: /Back/ }));
    await selectFormat(user, 'Last Mile (Excel)');
    expect(screen.queryByText('Will be uncompressed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate Excel' }));
    expect(props.onGenerate.mock.calls[0][0]).not.toHaveProperty('compressedPpt');
  });
});

describe('dashboard export wiring', () => {
  const openExport = async (user) => {
    render(<MemoryRouter><MobileToolsProvider><MobileHeader onMenuToggle={vi.fn()} /></MobileToolsProvider></MemoryRouter>);
    await user.click(screen.getByRole('link', { name: /PPT Generator/ }));
    await user.type(screen.getByPlaceholderText('Warehouse IDs (e.g. 1, 5, 12)'), '1');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
  };

  it.each([
    ['Last Mile (Excel)', 'Generate Excel', 'generateLastMileExcel'],
    ['TCI (External)', 'Generate PPT', 'generateTciPpt'],
    ['Godamwale (External)', 'Generate PPT', 'generateGodamwalePpt'],
    ['PPT v2 (Standard)', 'Generate PPT', 'generatePptV2'],
    ['PPT V3 (beta)', 'Generate PPT', 'generatePptV3'],
    ['Detailed PPT', 'Generate PPT', 'generateDetailedPpt'],
  ])('dispatches %s to its own service and closes on success', async (label, button, fn) => {
    const user = userEvent.setup();
    exports[fn].mockResolvedValue(undefined);
    await openExport(user);
    await selectFormat(user, label);
    expect(screen.queryByRole('checkbox', { name: /compressed PPT/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(exports[fn]).toHaveBeenCalledTimes(1));
    expect(exports[fn].mock.calls[0][0].ids).toBe('1');
    expect(exports[fn].mock.calls[0][0]).not.toHaveProperty('compressedPpt');
    for (const [name, service] of Object.entries(exports)) {
      if (name !== fn) expect(service).not.toHaveBeenCalled();
    }
    await waitFor(() => expect(screen.queryByPlaceholderText('Warehouse IDs (e.g. 1, 5, 12)')).not.toBeInTheDocument());
    expect(document.querySelector('.ant-modal-wrap').style.display).toBe('none');
  });

  it('keeps Excel configuration available for retry when generation fails', async () => {
    const user = userEvent.setup();
    exports.generateLastMileExcel.mockRejectedValueOnce(new Error('Workbook failed'));
    const error = vi.spyOn(message, 'error');
    await openExport(user);
    await selectFormat(user);
    await user.click(screen.getByRole('button', { name: 'Generate Excel' }));
    await waitFor(() => expect(error).toHaveBeenCalledWith('Workbook failed'));
    expect(screen.getByRole('button', { name: 'Generate Excel' })).toBeInTheDocument();
    error.mockRestore();
  });
});
