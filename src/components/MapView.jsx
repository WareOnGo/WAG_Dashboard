import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import { warehouseService } from '../services/warehouseService';
import { geoService, boundsToBbox } from '../services/geoService';
import { registerWarehouseIcons, warehouseIconId, availabilityExpression, AVAILABILITY_COLORS } from '../utils/geoIcons';
import { availabilityBucket } from '../utils/geoPopups';
import { createWarehouseViewportLoader, EMPTY_WAREHOUSE_POINTS } from '../utils/warehouseViewport';
import { useViewport } from '../hooks/useViewport';
import './MapView.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
const SOURCE = 'dashboard-warehouses';
const LAYER = 'dashboard-warehouse-pins';
const NO_FILTERS = {};
const INITIAL_STATUS = { loading: true, ready: false, count: 0, error: null, truncated: false, zoomRequired: false };

function WarehousePopup({ id, warehouse, loading, error, onRetry, onView, onEdit }) {
    const image = warehouse && getMediaFromWarehouse(warehouse).images?.[0];
    const space = Array.isArray(warehouse?.totalSpaceSqft)
        ? warehouse.totalSpaceSqft.reduce((sum, value) => sum + (Number(value) || 0), 0)
        : warehouse?.totalSpaceSqft;
    return (
        <div className="warehouse-map-card">
            <div className="warehouse-map-card__header">
                <strong>#{id}</strong>
                {warehouse && <span className="warehouse-map-card__availability" style={{ background: AVAILABILITY_COLORS[availabilityBucket(warehouse.availability)] }}>
                    {warehouse.availability || 'Unknown'}
                </span>}
            </div>
            {loading && <div role="status">Loading warehouse…</div>}
            {error && <div role="alert">Could not load this warehouse. <button onClick={onRetry}>Retry</button></div>}
            {warehouse && <>
                {image && <img className="warehouse-map-card__image" src={image} alt="" loading="lazy" crossOrigin="anonymous" onError={event => { event.currentTarget.style.display = 'none'; }} />}
                <strong className="warehouse-map-card__type">{warehouse.warehouseType}</strong>
                <div className="warehouse-map-card__owner">{warehouse.warehouseOwnerType}</div>
                <div>{[warehouse.city, warehouse.state].filter(Boolean).join(', ')}</div>
                <div className="warehouse-map-card__metrics">
                    <div><span>Space</span><strong>{space ? Number(space).toLocaleString() : '—'} sq ft</strong></div>
                    <div><span>Rate</span><strong>₹{warehouse.ratePerSqft || '—'}/sq ft</strong></div>
                </div>
                <div className="warehouse-map-card__actions">
                    <button className="warehouse-map-card__view" onClick={() => onView?.(warehouse)}>View</button>
                    <button onClick={() => onEdit?.(warehouse)}>Edit</button>
                </div>
            </>}
        </div>
    );
}

/** Warehouse-only viewport map. List pagination never controls its pin source. */
const MapView = ({ filters = NO_FILTERS, refreshKey = 0, active = true, onEdit, onViewDetails }) => {
    const { isMobile } = useViewport();
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const readyRef = useRef(false);
    const loaderRef = useRef(null);
    const popupRef = useRef(null);
    const detailCache = useRef(new Map());
    const propsRef = useRef(null);
    propsRef.current = { filters, active, isMobile, onEdit, onViewDetails };
    const [status, setStatus] = useState(INITIAL_STATUS);
    const [popupContent, setPopupContent] = useState(null);

    const refreshData = useCallback((force = false) => {
        if (!mapRef.current || !readyRef.current || !propsRef.current.active) return;
        void loaderRef.current?.load(boundsToBbox(mapRef.current.getBounds()), propsRef.current.filters, force);
    }, []);

    const loadPopup = useCallback(async (entry) => {
        if (!entry || popupRef.current !== entry) return;
        setPopupContent({ ...entry, loading: true, error: false });
        const cache = detailCache.current;
        if (!cache.has(entry.id)) {
            // Cache in-flight requests too: repeated clicks on the same pin need
            // only one detail request. Bound the cache during long map sessions.
            if (cache.size >= 100) cache.delete(cache.keys().next().value);
            const request = warehouseService.getById(entry.id).catch(error => {
                if (cache.get(entry.id) === request) cache.delete(entry.id);
                throw error;
            });
            cache.set(entry.id, request);
        }
        try {
            const warehouse = await cache.get(entry.id);
            if (popupRef.current === entry) setPopupContent({ ...entry, warehouse, loading: false, error: false });
        } catch {
            if (popupRef.current === entry) setPopupContent({ ...entry, loading: false, error: true });
        }
    }, []);

    useEffect(() => {
        if (!mapboxgl.accessToken) {
            setStatus({ ...INITIAL_STATUS, loading: false, error: 'The map is not configured.' });
            return;
        }
        let map;
        try {
            map = new mapboxgl.Map({
                container: containerRef.current,
                style: 'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2',
                center: [77.5946, 12.9716],
                zoom: 5,
                renderWorldCopies: false,
            });
        } catch {
            setStatus({ ...INITIAL_STATUS, loading: false, error: 'The map could not start. Please reload the page.' });
            return;
        }
        mapRef.current = map;
        const loader = createWarehouseViewportLoader({
            fetchPoints: geoService.warehouses,
            onData: fc => map.getSource(SOURCE)?.setData(fc),
            onStatus: patch => setStatus(current => ({ ...current, ...patch })),
        });
        loaderRef.current = loader;
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.getCanvas().setAttribute('aria-label', 'Warehouse map. Use arrow keys to pan and plus or minus to zoom.');

        let moveTimer;
        const scheduleRefresh = () => {
            clearTimeout(moveTimer);
            moveTimer = setTimeout(() => refreshData(), 180);
        };
        const resize = () => { map.resize(); scheduleRefresh(); };
        const observer = new ResizeObserver(resize);
        observer.observe(containerRef.current);
        window.addEventListener('resize', resize);
        window.addEventListener('orientationchange', resize);

        map.on('load', () => {
            map.resize();
            map.addSource(SOURCE, { type: 'geojson', data: EMPTY_WAREHOUSE_POINTS });
            registerWarehouseIcons(map);
            map.addLayer({
                id: LAYER,
                type: 'symbol',
                source: SOURCE,
                layout: {
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true,
                    'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.85, 12, 1.1, 16, 1.3],
                    'icon-image': ['match', availabilityExpression,
                        'available', warehouseIconId('available'),
                        'unavailable', warehouseIconId('unavailable'),
                        warehouseIconId('unknown')],
                },
                paint: { 'icon-emissive-strength': 1 },
            });
            readyRef.current = true;
            setStatus(current => ({ ...current, ready: true, error: null }));
            refreshData();
        });
        map.on('moveend', scheduleRefresh);
        map.on('error', () => {
            if (!readyRef.current) setStatus(current => ({ ...current, loading: false, error: 'The map could not load. Please reload the page.' }));
        });
        map.on('mouseenter', LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', LAYER, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', LAYER, event => {
            if (!propsRef.current.active) return;
            const feature = event.features?.[0];
            const id = Number(feature?.properties?.id);
            if (!Number.isInteger(id) || id <= 0) return;
            popupRef.current?.popup.remove();
            const element = document.createElement('div');
            element.className = 'warehouse-map-popup__scroll';
            const popup = new mapboxgl.Popup({
                anchor: 'bottom', offset: [0, -15], maxWidth: propsRef.current.isMobile ? '240px' : '260px',
                className: 'warehouse-map-popup', closeButton: true,
                closeOnClick: true, closeOnMove: false, focusAfterOpen: false,
            }).setLngLat(feature.geometry.coordinates).setDOMContent(element).addTo(map);
            const entry = { id, element, popup };
            popupRef.current = entry;
            // Details and images arrive after the native popup is created. Keep
            // its entire card inside the map as content or camera size changes.
            const positionPopup = () => {
                const { clientWidth: width, clientHeight: height } = containerRef.current;
                if (!width || !height) return;
                element.style.maxHeight = `${Math.max(80, height - 40)}px`;
                const node = popup.getElement();
                const { x, y } = map.project(feature.geometry.coordinates);
                const left = x - node.offsetWidth / 2;
                const top = y - node.offsetHeight - 15;
                const dx = Math.max(8, Math.min(left, width - node.offsetWidth - 8)) - left;
                const dy = Math.max(8, Math.min(top, height - node.offsetHeight - 8)) - top;
                popup.setOffset([dx, dy - 15]);
                node.classList.toggle('warehouse-map-popup--shifted', Math.abs(dx) > 1 || Math.abs(dy) > 1);
            };
            const popupObserver = new ResizeObserver(positionPopup);
            popupObserver.observe(element);
            map.on('move', positionPopup);
            popup.on('close', () => {
                popupObserver.disconnect();
                map.off('move', positionPopup);
                if (popupRef.current !== entry) return;
                popupRef.current = null;
                setPopupContent(null);
            });
            void loadPopup(entry);
        });

        return () => {
            clearTimeout(moveTimer);
            observer.disconnect();
            window.removeEventListener('resize', resize);
            window.removeEventListener('orientationchange', resize);
            loader.dispose();
            const entry = popupRef.current;
            popupRef.current = null;
            entry?.popup.remove();
            detailCache.current.clear();
            readyRef.current = false;
            loaderRef.current = null;
            mapRef.current = null;
            map.remove();
        };
    }, [refreshData, loadPopup]);

    // New filters and mutations invalidate cached pins and popup details, while
    // retaining the map instance and the user's camera position.
    useEffect(() => {
        loaderRef.current?.reset();
        detailCache.current = new Map();
        popupRef.current?.popup.remove();
        if (active) refreshData(true);
    }, [filters, refreshKey, active, refreshData]);

    return (
        <div className="map-view" role="region" aria-label="Warehouse map">
            <div ref={containerRef} className="map-view__canvas" />
            <div className="map-info" role="status" aria-live="polite">
                {status.loading ? 'Loading warehouse pins…' : status.zoomRequired ? 'Zoom in to load warehouse pins' : `${status.count} warehouse pins loaded`}
                {status.truncated && <div className="map-info__warning">Zoom in to see all warehouses.</div>}
                {status.error && <div className="map-info__error">{status.error}
                    {status.ready && <button onClick={() => refreshData(true)}>Retry</button>}
                </div>}
            </div>
            {popupContent && createPortal(
                <WarehousePopup {...popupContent} onRetry={() => loadPopup(popupRef.current)} onView={onViewDetails} onEdit={onEdit} />,
                popupContent.element,
            )}
        </div>
    );
};

export default MapView;
