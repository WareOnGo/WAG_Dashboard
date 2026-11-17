import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import VoiceNotesList from '../VoiceNotesList';
import { warehouseService } from '../../services/warehouseService';
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getVoiceNotePlayback: vi.fn() } }));
const note = { id: 'test-note', durationMs: 43000 };
beforeEach(() => {
  vi.clearAllMocks();
  warehouseService.getVoiceNotePlayback.mockResolvedValue({ url: 'https://private.invalid/audio.m4a' });
});
it('loads a private recording only when requested, using the staged record context', async () => {
  render(<VoiceNotesList notes={[note]} recordId="staged-uuid" />);
  expect(warehouseService.getVoiceNotePlayback).not.toHaveBeenCalled();
  expect(screen.getByText('0:43')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Listen to recording' }));
  await waitFor(() => expect(screen.getByLabelText('Play voice note 1')).toHaveAttribute('src', 'https://private.invalid/audio.m4a'));
  expect(warehouseService.getVoiceNotePlayback).toHaveBeenCalledWith('staged-uuid', 'test-note');
  expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
});
it('removes a note from an edit without immediately deleting storage', async () => {
  const onChange = vi.fn();
  render(<VoiceNotesList notes={[note]} recordId={123} onChange={onChange} />);
  await userEvent.click(screen.getByRole('button', { name: 'Delete voice note 1' }));
  expect(onChange).toHaveBeenCalledWith([]);
  expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
});
it('shows a retry action when private playback cannot be loaded', async () => {
  warehouseService.getVoiceNotePlayback.mockRejectedValueOnce(new Error('Offline'));
  render(<VoiceNotesList notes={[note]} recordId={123} />);
  await userEvent.click(screen.getByRole('button', { name: 'Listen to recording' }));
  await screen.findByText('Offline');
  await userEvent.click(screen.getByRole('button', { name: 'Reload audio' }));
  await screen.findByLabelText('Play voice note 1');
});
