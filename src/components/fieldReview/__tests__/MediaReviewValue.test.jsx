import { render, screen } from '@testing-library/react';
import MediaReviewValue from '../MediaReviewValue';

it('distinguishes an incomplete historical record from an explicitly empty gallery', () => {
  const view = render(<MediaReviewValue value={{ __summary: 'object', keys: ['images', 'videos', 'docs'], bytes: 1200 }} />);
  expect(screen.getByText('Full media snapshot unavailable.')).toBeInTheDocument();
  expect(screen.queryByText('No media uploaded')).not.toBeInTheDocument();
  view.rerender(<MediaReviewValue value={{ images: { __summary: 'array', length: 21 }, videos: [], docs: [] }} />);
  expect(screen.getByText('Full media snapshot unavailable.')).toBeInTheDocument();
  view.rerender(<MediaReviewValue value={{ images: [], videos: [], docs: [] }} />);
  expect(screen.getByText('No media uploaded')).toBeInTheDocument();
  expect(screen.queryByText('Full media snapshot unavailable.')).not.toBeInTheDocument();
});
