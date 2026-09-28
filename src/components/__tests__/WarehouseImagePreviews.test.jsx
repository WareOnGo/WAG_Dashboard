import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import SimpleWarehouseCard from '../SimpleWarehouseCard';
import WarehouseCard from '../WarehouseCard';

describe.each([
  { name: 'SimpleWarehouseCard', component: SimpleWarehouseCard },
  { name: 'WarehouseCard', component: WarehouseCard },
])('$name image preview', ({ component }) => {
  const Card = component;
  const originalUrl = 'https://cdn/warehouse.jpg';
  const jpegUrl = 'https://cdn/jpeg/compressed.jpg';

  it('uses the JPEG pair and retries the original when it fails', () => {
    renderWithProviders(<Card warehouse={{ ...mockWarehouse,
      images: [{ originalUrl, jpegUrl, webpUrl: 'https://cdn/warehouse.webp' }],
    }} />, { auth: { user: null } });
    const image = screen.getByAltText(`Warehouse ${mockWarehouse.id}`);
    expect(image).toHaveAttribute('src', jpegUrl);
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', originalUrl);
    expect(image).toBeVisible();
  });

  it('shows legacy images when variant metadata is unavailable', () => {
    renderWithProviders(<Card warehouse={{ ...mockWarehouse, media: null, photos: originalUrl }} />,
      { auth: { user: null } });
    expect(screen.getByAltText(`Warehouse ${mockWarehouse.id}`)).toHaveAttribute('src', originalUrl);
  });
});
