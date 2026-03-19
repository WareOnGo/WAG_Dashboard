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
    const markers = useRef(new Map()); // Use Map for O(1) lookup by warehouse ID
    const markersPool = useRef([]); // Pool of unused markers for reuse

    // Initialize map
    useEffect(() => {
        if (map.current) return;

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

        const observer = new ResizeObserver(() => map.current?.resize());
        observer.observe(mapContainer.current);

        return () => {
            // Clean up markers when map is destroyed
            markersRef.forEach(marker => marker.remove());
            markersRef.clear();
            poolRef.length = 0;

            observer.disconnect();
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
                        ? `<img src="${firstImage}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px;" onerror="this.style.display='none'" loading="lazy" />`
                        : '';

                    // Create popup HTML
                    const popupHTML = `
        <div style="font-family:system-ui;padding:10px;min-width:220px;max-width:260px;background:rgba(26,26,26,0.98);color:rgba(255,255,255,0.95);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);">
            <span style="font-size:13px;font-weight:600;color:#fff;">#${warehouse.id}</span>
            <span style="font-size:10px;padding:3px 8px;background:${getMarkerColor()};border-radius:4px;color:#fff;font-weight:500;">${warehouse.availability || 'Unknown'}</span>
          </div>
          ${imageHtml ? `<div style="margin-bottom:8px;">${imageHtml.replace('height:120px', 'height:80px')}</div>` : ''}
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;color:#fff;line-height:1.3;">${warehouse.warehouseType}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-bottom:8px;">${warehouse.warehouseOwnerType || ''}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:8px;line-height:1.4;">
            📍 ${warehouse.city}, ${warehouse.state}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;margin-bottom:8px;">
            <div>
              <div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:2px;letter-spacing:0.5px;">Space</div>
              <div style="font-size:12px;font-weight:600;color:#fff;">${formatSpace(warehouse.totalSpaceSqft)} sqft</div>
            </div>
            <div>
              <div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:2px;letter-spacing:0.5px;">Rate</div>
              <div style="font-size:12px;font-weight:600;color:#fff;">₹${warehouse.ratePerSqft || '—'}/sqft</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15);">
            <button onclick="window.warehouseMapActions.view(${warehouse.id})" style="flex:1;padding:6px;font-size:11px;font-weight:500;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='#40a9ff'" onmouseout="this.style.background='#1890ff'">View</button>
            <button onclick="window.warehouseMapActions.edit(${warehouse.id})" style="flex:1;padding:6px;font-size:11px;font-weight:500;background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:4px;cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">Edit</button>
          </div>
        </div>
      `;

                    const popup = new mapboxgl.Popup({
                        offset: 15,
                        maxWidth: '260px',
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
