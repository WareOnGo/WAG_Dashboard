import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './MapView.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * MapView Component
 * Renders warehouses on a Mapbox map with dark theme
 */
const MapView = ({ warehouses = [], onEdit, onDelete, onViewDetails }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markers = useRef([]);

    // Initialize map
    useEffect(() => {
        if (map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [77.5946, 12.9716], // India center
            zoom: 5,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        const observer = new ResizeObserver(() => map.current?.resize());
        observer.observe(mapContainer.current);

        return () => {
            observer.disconnect();
            map.current?.remove();
            map.current = null;
        };
    }, []);

    // Update markers when warehouses change
    useEffect(() => {
        if (!map.current) return;

        // Remove existing markers
        markers.current.forEach((m) => m.remove());
        markers.current = [];

        // Filter warehouses with valid coordinates
        const validWarehouses = warehouses.filter(
            (w) => {
                const lat = parseFloat(w.latitude || w.WarehouseData?.latitude || w.warehouseData?.latitude);
                const lng = parseFloat(w.longitude || w.WarehouseData?.longitude || w.warehouseData?.longitude);
                return !isNaN(lat) &&
                    !isNaN(lng) &&
                    lat >= -90 && lat <= 90 &&
                    lng >= -180 && lng <= 180;
            }
        );

        // Add new markers
        validWarehouses.forEach((warehouse) => {
            // Get coordinates from either direct fields or nested WarehouseData
            const latitude = warehouse.latitude || warehouse.WarehouseData?.latitude || warehouse.warehouseData?.latitude;
            const longitude = warehouse.longitude || warehouse.WarehouseData?.longitude || warehouse.warehouseData?.longitude;
            // Format space
            const formatSpace = (space) => {
                if (!space) return '-';
                if (Array.isArray(space)) {
                    return space.reduce((sum, val) => sum + val, 0).toLocaleString();
                }
                return space.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            };

            // Get marker color based on availability
            const getMarkerColor = () => {
                const availability = warehouse.availability?.toLowerCase();
                if (availability?.includes('available')) return '#3d8b40'; // Darker green
                if (availability?.includes('occupied')) return '#c62828'; // Darker red
                if (availability?.includes('partial')) return '#d68910'; // Darker orange
                return '#0d5a9e'; // Darker blue
            };

            // Get first image
            const getFirstImage = () => {
                if (!warehouse.photos) return null;
                const imageUrls = warehouse.photos
                    .split(',')
                    .map((url) => url.trim())
                    .filter((url) => url && url.length > 0);
                return imageUrls.length > 0 ? imageUrls[0] : null;
            };

            const firstImage = getFirstImage();
            const imageHtml = firstImage
                ? `<img src="${firstImage}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px;" onerror="this.style.display='none'" />`
                : '';

            // Create popup HTML
            const popupHTML = `
        <div style="font-family:system-ui;padding:8px;min-width:260px;max-width:300px;background:rgba(31,31,31,0.95);color:rgba(255,255,255,0.85);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.1);">
            <span style="font-size:13px;font-weight:500;">#${warehouse.id}</span>
            <span style="font-size:11px;padding:2px 8px;background:${getMarkerColor()};border-radius:4px;color:white;">${warehouse.availability || 'Unknown'}</span>
          </div>
          ${imageHtml}
          <div style="font-size:15px;font-weight:600;margin-bottom:4px;">${warehouse.warehouseType}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-bottom:8px;">${warehouse.warehouseOwnerType || ''}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-bottom:8px;">
            📍 ${warehouse.city}, ${warehouse.state} · ${warehouse.zone}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;background:rgba(0,0,0,0.2);border-radius:6px;margin-bottom:8px;">
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;">Total Space</div>
              <div style="font-size:13px;font-weight:500;">${formatSpace(warehouse.totalSpaceSqft)} sqft</div>
            </div>
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;">Rate</div>
              <div style="font-size:13px;font-weight:500;">₹${warehouse.ratePerSqft || '—'}/sqft</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);">
            <button onclick="window.warehouseMapActions.view(${warehouse.id})" style="flex:1;padding:6px;font-size:11px;background:#1890ff;color:white;border:none;border-radius:4px;cursor:pointer;">View</button>
            <button onclick="window.warehouseMapActions.edit(${warehouse.id})" style="flex:1;padding:6px;font-size:11px;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:4px;cursor:pointer;">Edit</button>
            <button onclick="window.warehouseMapActions.delete(${warehouse.id})" style="flex:1;padding:6px;font-size:11px;background:#ff4d4f;color:white;border:none;border-radius:4px;cursor:pointer;">Delete</button>
          </div>
        </div>
      `;

            const popup = new mapboxgl.Popup({
                offset: 25,
                maxWidth: '320px',
                closeButton: true,
                closeOnClick: false,
            }).setHTML(popupHTML);

            const marker = new mapboxgl.Marker({
                color: getMarkerColor(),
            })
                .setLngLat([parseFloat(longitude), parseFloat(latitude)])
                .setPopup(popup)
                .addTo(map.current);

            markers.current.push(marker);
        });

        // Set up global actions for popup buttons
        window.warehouseMapActions = {
            view: (id) => {
                const warehouse = warehouses.find((w) => w.id === id);
                if (warehouse && onViewDetails) onViewDetails(warehouse);
            },
            edit: (id) => {
                const warehouse = warehouses.find((w) => w.id === id);
                if (warehouse && onEdit) onEdit(warehouse);
            },
            delete: (id) => {
                const warehouse = warehouses.find((w) => w.id === id);
                if (warehouse && onDelete) onDelete(warehouse);
            },
        };
    }, [warehouses, onEdit, onDelete, onViewDetails]);

    // Count valid warehouses
    const validCount = warehouses.filter(
        (w) => {
            const lat = parseFloat(w.latitude || w.WarehouseData?.latitude || w.warehouseData?.latitude);
            const lng = parseFloat(w.longitude || w.WarehouseData?.longitude || w.warehouseData?.longitude);
            return !isNaN(lat) &&
                !isNaN(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180;
        }
    ).length;

    return (
        <div className="map-view">
            <div
                ref={mapContainer}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                }}
            />

            {/* Map info overlay */}
            <div className="map-info">
                <div className="map-info__count">
                    {validCount} warehouse{validCount !== 1 ? 's' : ''} on map
                </div>
                {warehouses.length > validCount && (
                    <div className="map-info__warning">
                        {warehouses.length - validCount} warehouse{warehouses.length - validCount !== 1 ? 's' : ''} without coordinates
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapView;
