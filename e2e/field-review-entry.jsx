// Production components + API client against a disposable real database.
// Only sign-in and the dashboard's list-loading shell are fixtures.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from 'antd';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthContext from '../src/contexts/AuthContext';
import ProductTheme from '../src/ProductTheme';
import CardView from '../src/components/CardView';
import MobileHeader from '../src/components/MobileHeader';
import MobileNavigation from '../src/components/MobileNavigation';
import {MobileToolsProvider} from '../src/contexts/MobileToolsContext';
import WarehouseDetailsModal from '../src/components/WarehouseDetailsModal';
import FieldReviewQueue from '../src/components/FieldReviewQueue';
import DashboardReference from '../src/components/Dashboard';
import { apiClient } from '../src/services/apiClient';
import { setStoredToken } from '../src/utils/tokenStorage';
import '../src/index.css';
import '../src/App.css';
import '../src/styles/dashboard-mobile.css';
function Dashboard() {
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    const load = () => apiClient.get('/fixture/warehouses').then(setRows);
    load();
    window.addEventListener('warehouse-field-review-updated', load);
    return () => window.removeEventListener('warehouse-field-review-updated', load);
  }, []);
  return <><h1>Warehouse Dashboard</h1><CardView warehouses={rows} paginated={false} onViewDetails={setSelected} /><WarehouseDetailsModal warehouse={selected} visible={!!selected} onClose={() => setSelected(null)} /></>;
}
function Fixture() {
  const [user, setUser] = useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  useEffect(() => {
    const role = new URLSearchParams(location.search).get('role') || sessionStorage.getItem('field-review-fixture-role') || 'admin';
    sessionStorage.setItem('field-review-fixture-role', role);
    fetch('/fixture/session/' + role).then(r => r.json()).then(r => {
      setStoredToken(r.token);
      setUser(r.user);
    });
  }, []);
  if (!user) return <p>Loading fixture…</p>;
  return <AuthContext.Provider value={{
    user,
    isAuthenticated: true
  }}><BrowserRouter><MobileToolsProvider><ProductTheme><App>
  <MobileHeader onMenuToggle={()=>setMenuOpen(v=>!v)} isMenuOpen={menuOpen}/>
  <MobileNavigation visible={menuOpen} onClose={()=>setMenuOpen(false)}/>
  <main style={{
            padding: 24
          }}><Routes><Route path="/field-reviews" element={<FieldReviewQueue />} /><Route path="/dashboard-reference" element={<DashboardReference />} /><Route path="*" element={<Dashboard />} /></Routes></main>
 </App></ProductTheme></MobileToolsProvider></BrowserRouter></AuthContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
