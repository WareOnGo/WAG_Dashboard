import { joinPastedLines, pasteAsOneLine } from '../pasteLines';

describe('joinPastedLines', () => {
  it('joins a spreadsheet column or row into one comma-separated line', () => {
    expect(joinPastedLines('412\r\n87\r\n1503\r\n')).toBe('412, 87, 1503');
    expect(joinPastedLines('412\t87')).toBe('412, 87');
    expect(joinPastedLines('9845012345\n9845012346')).toBe('9845012345, 9845012346');
  });

  it('leaves a single-line paste alone', () => {
    expect(joinPastedLines('412, 87')).toBeNull();
    expect(joinPastedLines('98450 12345')).toBeNull();
  });
});

describe('pasteAsOneLine', () => {
  const paste = (text, target) => ({
    clipboardData: { getData: () => text }, target, preventDefault: vi.fn(),
  });

  it('replaces the selection with the joined paste', () => {
    const setValue = vi.fn();
    const event = paste('412\n87', { selectionStart: 0, selectionEnd: 3 });
    pasteAsOneLine(event, 'old', setValue);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(setValue).toHaveBeenCalledWith('412, 87');
  });

  it('lets a single-line paste through untouched', () => {
    const setValue = vi.fn();
    const event = paste('Peenya', { selectionStart: 0, selectionEnd: 0 });
    pasteAsOneLine(event, '', setValue);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(setValue).not.toHaveBeenCalled();
  });
});
