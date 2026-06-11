import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import { useViewport } from '../hooks/useViewport';
import './MapView.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * MapView Component
 * Renders warehouses on a Mapbox map with dark theme
 */
const MapView = ({ warehouses = [], onEdit, onDelete, onViewDetails }) => {
    const { isMobile } = useViewport();
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markers = useRef(new Map()); // Use Map for O(1) lookup by warehouse ID
    const markersPool = useRef([]); // Pool of unused markers for reuse

    // Initialize map
    useEffect(() => {
        if (map.current) return;

        if (!mapboxgl.accessToken) {
            console.warn('[MapView] VITE_MAPBOX_TOKEN is not set — the map will not render.');
            return;
        }

        // Copy refs to local variables for cleanup
        const markersRef = markers.current;
        const poolRef = markersPool.current;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2', // Custom dark streets style
            center: [77.5946, 12.9716], // India center
            zoom: 5,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Correct any initial 0-size canvas once the map has loaded. On mobile the
        // container can mount before its height resolves, leaving a blank canvas.
        map.current.once('load', () => map.current?.resize());

        const observer = new ResizeObserver(() => map.current?.resize());
        observer.observe(mapContainer.current);

        // ResizeObserver is unreliable on iOS Safari for orientation flips, so listen
        // explicitly for window resize / orientation change too.
        const handleResize = () => map.current?.resize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            // Clean up markers when map is destroyed
            markersRef.forEach(marker => marker.remove());
            markersRef.clear();
            poolRef.length = 0;

            observer.disconnect();
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update markers when warehouses change
    useEffect(() => {
        if (!map.current) return;

        // Function to update markers
        const updateMarkers = () => {
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

            // Create a set of current warehouse IDs for quick lookup
            const currentIds = new Set(validWarehouses.map(w => w.id));

            // Remove markers that are no longer in the filtered list (reuse them)
            markers.current.forEach((marker, id) => {
                if (!currentIds.has(id)) {
                    marker.remove();
                    markersPool.current.push(marker);
                    markers.current.delete(id);
                }
            });

            // Add or update markers
            validWarehouses.forEach((warehouse) => {
                // Get coordinates from either direct fields or nested WarehouseData
                const latitude = warehouse.latitude || warehouse.WarehouseData?.latitude || warehouse.warehouseData?.latitude;
                const longitude = warehouse.longitude || warehouse.WarehouseData?.longitude || warehouse.warehouseData?.longitude;

                // Check if marker already exists
                const existingMarker = markers.current.get(warehouse.id);
                if (existingMarker) {
                    // Update existing marker position if needed
                    const currentLngLat = existingMarker.getLngLat();
                    const newLng = parseFloat(longitude);
                    const newLat = parseFloat(latitude);

                    if (currentLngLat.lng !== newLng || currentLngLat.lat !== newLat) {
                        existingMarker.setLngLat([newLng, newLat]);
                    }
                    // Skip creating new marker - just return from this iteration
                } else {
                    // Create new marker only if it doesn't exist

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
                        if (availability === 'yes') return '#3d8b40'; // Darker green
                        if (availability === 'no') return '#c62828'; // Darker red
                        if (availability?.includes('available')) return '#3d8b40'; // Darker green
                        if (availability?.includes('occupied')) return '#c62828'; // Darker red
                        if (availability?.includes('partial')) return '#d68910'; // Darker orange
                        return '#0d5a9e'; // Darker blue
                    };

                    // Get first image from media (with fallback to photos CSV)
                    const getFirstImage = () => {
                        const media = getMediaFromWarehouse(warehouse);
                        return media.images?.[0] || null;
                    };

                    // Compact popup sizing on mobile so the card doesn't overflow the
                    // small map pane; roomier on desktop.
                    const s = isMobile
                        ? { pad: 8, minW: 150, maxW: 190, imgH: 64, id: 12, badge: 9, title: 12, sub: 10, loc: 11, label: 8, val: 11, btn: 10, btnPad: 5, gap: 5, mb: 6 }
                        : { pad: 10, minW: 220, maxW: 260, imgH: 80, id: 13, badge: 10, title: 14, sub: 11, loc: 12, label: 9, val: 12, btn: 11, btnPad: 6, gap: 8, mb: 8 };

                    const firstImage = getFirstImage();
                    const imageHtml = firstImage
                        ? `<img src="${firstImage}" style="width:100%;height:${s.imgH}px;object-fit:cover;border-radius:6px;margin-bottom:${s.mb}px;" onerror="this.style.display='none'" loading="lazy" crossorigin="anonymous" />`
                        : '';

                    // Create popup HTML
                    const popupHTML = `
        <div style="font-family:Verdana,Geneva,sans-serif;padding:${s.pad}px;min-width:${s.minW}px;max-width:${s.maxW}px;background:rgba(26,26,26,0.98);color:rgba(255,255,255,0.95);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${s.mb}px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);">
            <span style="font-size:${s.id}px;font-weight:600;color:#fff;">#${warehouse.id}</span>
            <span style="font-size:${s.badge}px;padding:3px 8px;background:${getMarkerColor()};border-radius:4px;color:#fff;font-weight:500;">${warehouse.availability || 'Unknown'}</span>
          </div>
          ${imageHtml ? `<div style="margin-bottom:${s.mb}px;">${imageHtml}</div>` : ''}
          <div style="font-size:${s.title}px;font-weight:600;margin-bottom:4px;color:#fff;line-height:1.3;">${warehouse.warehouseType}</div>
          <div style="font-size:${s.sub}px;color:rgba(255,255,255,0.65);margin-bottom:${s.mb}px;">${warehouse.warehouseOwnerType || ''}</div>
          <div style="font-size:${s.loc}px;color:rgba(255,255,255,0.85);margin-bottom:${s.mb}px;line-height:1.4;">
            📍 ${warehouse.city}, ${warehouse.state}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:${s.gap}px;padding:${s.pad}px;background:rgba(0,0,0,0.3);border-radius:4px;margin-bottom:${s.mb}px;">
            <div>
              <div style="font-size:${s.label}px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:2px;letter-spacing:0.5px;">Space</div>
              <div style="font-size:${s.val}px;font-weight:600;color:#fff;">${formatSpace(warehouse.totalSpaceSqft)} sqft</div>
            </div>
            <div>
              <div style="font-size:${s.label}px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:2px;letter-spacing:0.5px;">Rate</div>
              <div style="font-size:${s.val}px;font-weight:600;color:#fff;">₹${warehouse.ratePerSqft || '—'}/sqft</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15);">
            <button onclick="window.warehouseMapActions.view(${warehouse.id})" style="flex:1;padding:${s.btnPad}px;font-size:${s.btn}px;font-weight:500;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='#40a9ff'" onmouseout="this.style.background='#1890ff'">View</button>
            <button onclick="window.warehouseMapActions.edit(${warehouse.id})" style="flex:1;padding:${s.btnPad}px;font-size:${s.btn}px;font-weight:500;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">Edit</button>
          </div>
        </div>
      `;

                    const popup = new mapboxgl.Popup({
                        offset: 15,
                        maxWidth: `${s.maxW}px`,
                        closeButton: false,
                        closeOnClick: true,
                        closeOnMove: false,
                        anchor: 'left', // Always render to the right side of the marker
                    }).setHTML(popupHTML);

                    // Reuse marker from pool or create new one
                    let marker;
                    if (markersPool.current.length > 0) {
                        marker = markersPool.current.pop();
                        marker.setLngLat([parseFloat(longitude), parseFloat(latitude)]);
                        marker.setPopup(popup);
                        // Update color by getting the marker element
                        const markerElement = marker.getElement();
                        const svg = markerElement.querySelector('svg');
                        if (svg) {
                            svg.setAttribute('fill', getMarkerColor());
                        }
                    } else {
                        marker = new mapboxgl.Marker({
                            color: getMarkerColor(),
                        })
                            .setLngLat([parseFloat(longitude), parseFloat(latitude)])
                            .setPopup(popup);
                    }

                    marker.addTo(map.current);
                    markers.current.set(warehouse.id, marker);
                }
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
        };

        // Wait for map to be fully loaded
        if (!map.current.loaded()) {
            map.current.once('load', updateMarkers);
        } else {
            updateMarkers();
        }
    }, [warehouses, onEdit, onDelete, onViewDetails, isMobile]);

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

            {/* Map info overlay — hidden on mobile to keep the small map clean */}
            {!isMobile && (
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
            )}
        </div>
    );
};

export default MapView;
