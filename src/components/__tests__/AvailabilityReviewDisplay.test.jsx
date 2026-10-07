import { expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import SimpleWarehouseCard from '../SimpleWarehouseCard';

it.each([
  [null, 'Not recorded'],
  ['2025-01-02T00:00:00.000Z', '02 Jan 2025'],
])('shows availability freshness on the listing for %p', (date, label) => {
  renderWithProviders(<SimpleWarehouseCard warehouse={{ ...mockWarehouse,
    availability: 'Yes', availabilityLastReviewedOn: date, photos: '', media: null,
  }} />, { auth: { user: null } });
  expect(screen.getByText('Availability: Yes')).toBeInTheDocument();
  expect(screen.getByText(`Availability last reviewed: ${label}`)).toBeInTheDocument();
});
