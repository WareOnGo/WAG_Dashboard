import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  it.each([false, true])('selects and submits an Excel export on mobile=%s', async (isMobile) => {
    viewport.isMobile = isMobile;
    const props = modalProps();
    const user = userEvent.setup();
    render(<PptConfigModal {...props} />);
    await selectFormat(user);
    expect(screen.getByText('Workbook Details')).toBeInTheDocument();
    expect(screen.queryByText('WareOnGo POC')).not.toBeInTheDocument();
    expect(screen.queryByText('Include rent / commercials')).not.toBeInTheDocument();
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

describe('dashboard export wiring', () => {
  const openExport = async (user) => {
    render(<MobileToolsProvider><MobileHeader onMenuToggle={vi.fn()} /></MobileToolsProvider>);
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
    await user.click(screen.getByRole('button', { name: button }));
    await waitFor(() => expect(exports[fn]).toHaveBeenCalledTimes(1));
    expect(exports[fn].mock.calls[0][0].ids).toBe('1');
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
