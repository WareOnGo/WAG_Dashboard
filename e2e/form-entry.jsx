// Local browser fixture: the production form, review queue and API client.
// Only OAuth identity and the surrounding dashboard navigation are fixtures.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App, ConfigProvider, theme } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../src/contexts/AuthContext';
import WarehouseForm from '../src/components/WarehouseForm';
import ReviewQueue from '../src/components/ReviewQueue';
import { warehouseService } from '../src/services/warehouseService';
import '../src/index.css';
import '../src/styles/product-theme.css';

const params = new URLSearchParams(location.search);
export default function Fixture() {
  const id = params.get('id');
  const [initialData, setInitialData] = useState(null);
  const [loaded, setLoaded] = useState(!id);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    Promise.all([warehouseService.getById(id), warehouseService.getContactNumber(id, 'Disposable QA form edit')])
      .then(([record, contact]) => { setInitialData({ ...record, contactNumber: contact.contactNumber }); setLoaded(true); })
      .catch(err => setError(err.message));
  }, [id]);
  if (params.has('review')) return <ReviewQueue />;
  return <>
    {error && <p role="alert">{error}</p>}
    {result ? <pre data-testid="receipt">{JSON.stringify(result)}</pre> : loaded && <WarehouseForm visible
      initialData={initialData} onCancel={() => setResult({ cancelled: true })}
      onSubmit={async payload => {
        try { setResult(await (id ? warehouseService.update(id, payload) : warehouseService.create(payload))); }
        catch (err) { setError(err.message); throw err; }
      }} />}
  </>;
}
createRoot(document.getElementById('root')).render(
  <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#bb9af7', motion: false } }}>
    <MemoryRouter><AuthContext.Provider value={{ user: { email: 'dashboard@example.test', isAdmin: true, isReviewer: true } }}>
      <App><Fixture /></App>
    </AuthContext.Provider></MemoryRouter>
  </ConfigProvider>,
);
