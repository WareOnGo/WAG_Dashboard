import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FileUpload from '../FileUpload';
import { warehouseService } from '../../services/warehouseService';
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getPresignedUrl: vi.fn() } }));
vi.mock('../../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: false }) }));
vi.mock('../../hooks/useErrorHandler', () => ({ useErrorHandler: () => ({ handleUploadError: vi.fn(), showSuccessMessage: vi.fn(), showErrorMessage: vi.fn() }) }));
const requests = [];
class UploadRequest extends EventTarget {
  upload = new EventTarget();
  status = 200;
  open() {}
  headers = {};
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(file) { this.file = file; requests.push(this); }
  abort() { this.aborted = true; this.dispatchEvent(new Event('abort')); this.dispatchEvent(new Event('loadend')); }
  finish() { this.dispatchEvent(new Event('load')); this.dispatchEvent(new Event('loadend')); }
}
const empty = { images: [], videos: [], docs: [] };
const file = name => new File(['image fixture'], name, { type: 'image/jpeg' });
beforeEach(() => { requests.length = 0; vi.clearAllMocks(); vi.stubGlobal('XMLHttpRequest', UploadRequest); });
afterEach(() => vi.unstubAllGlobals());

it('normal warehouse uploads retain multiple files even when responses finish in reverse order', async () => {
  warehouseService.getPresignedUrl.mockResolvedValueOnce({ uploadUrl: '/first', imageUrl: 'https://media.test/first.jpg' })
    .mockResolvedValueOnce({ uploadUrl: '/second', imageUrl: 'https://media.test/second.jpg' });
  const onChange = vi.fn(), uploading = vi.fn();
  const { container } = render(<FileUpload value={empty} onChange={onChange} onUploadingChange={uploading} />);
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file('first.jpg'), file('second.jpg')] } });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(uploading).toHaveBeenLastCalledWith(true);
  await act(async () => requests[1].finish());
  await act(async () => requests[0].finish());
  expect(onChange).toHaveBeenLastCalledWith({ ...empty, images: ['https://media.test/second.jpg', 'https://media.test/first.jpg'] });
  expect(uploading).toHaveBeenLastCalledWith(false);
});

it('a gallery limit includes pending uploads and closing the editor aborts them', async () => {
  const requestPresignedUrl = vi.fn().mockResolvedValue({ uploadUrl: '/review', imageUrl: 'https://media.test/replacement.jpg' });
  const onChange = vi.fn(), uploading = vi.fn();
  const { container, unmount } = render(<FileUpload value={{ ...empty, images: ['https://media.test/existing.jpg'] }} onChange={onChange} onUploadingChange={uploading}
    requestPresignedUrl={requestPresignedUrl} maxFiles={2} />);
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file('first.jpg'), file('second.jpg')] } });
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requestPresignedUrl).toHaveBeenCalledTimes(1);
  expect(warehouseService.getPresignedUrl).not.toHaveBeenCalled();
  unmount();
  await act(async () => {});
  expect(requests[0].aborted).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  expect(uploading).toHaveBeenLastCalledWith(false);
});

it('ignores a signing response after closing and prevents removal in a disabled editor', async () => {
  let finishSigning;
  const requestPresignedUrl = vi.fn(() => new Promise(resolve => { finishSigning = resolve; }));
  const onChange = vi.fn();
  const view = render(<FileUpload value={empty} onChange={onChange} requestPresignedUrl={requestPresignedUrl} />);
  fireEvent.change(view.container.querySelector('input[type=file]'), { target: { files: [file('first.jpg')] } });
  await waitFor(() => expect(requestPresignedUrl).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => finishSigning({ uploadUrl: '/late', imageUrl: 'https://media.test/late.jpg' }));
  expect(requests).toHaveLength(0);
  expect(onChange).not.toHaveBeenCalled();
  render(<FileUpload value={{ ...empty, images: ['https://media.test/original.jpg'] }} disabled onChange={onChange} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Remove file 1' }));
  expect(onChange).not.toHaveBeenCalled();
});

it('honors the server-signed upload headers for media review', async () => {
  const requestPresignedUrl = vi.fn().mockResolvedValue({ uploadUrl: '/review', imageUrl: 'https://media.test/new.jpg',
    instructions: { headers: { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' } } });
  const onChange = vi.fn();
  const { container } = render(<FileUpload value={empty} onChange={onChange} requestPresignedUrl={requestPresignedUrl} />);
  fireEvent.change(container.querySelector('input[type=file]'), { target: { files: [file('new.jpg')] } });
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].headers).toEqual({ 'Content-Type': 'image/jpeg', 'If-None-Match': '*' });
  await act(async () => requests[0].finish());
  expect(onChange).toHaveBeenLastCalledWith({ ...empty, images: ['https://media.test/new.jpg'] });
});
