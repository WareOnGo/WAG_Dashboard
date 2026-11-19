import useFieldReviewCreation from './fieldReview/useFieldReviewCreation';
import FieldReviewSelection from './fieldReview/FieldReviewSelection';
import { FieldReviewSelectionContext } from './fieldReview/SelectionContext';
import { FieldReviewHighlightContext } from './fieldReview/HighlightContext';
import useFieldReviewHighlights from './fieldReview/useFieldReviewHighlights';
import { withDefaultUnit } from '../utils/measurementDisplay';
import ImageWithFallback from './ImageWithFallback';
import VoiceNotesList from './VoiceNotesList';
import { imageVariant } from '../utils/mediaUtils';
import { useState, useEffect, useContext } from 'react';
import { Alert, Image, Space, Button, Spin, Tag } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  UndoOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  LinkOutlined,
  ExportOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import ResponsiveModal from './ResponsiveModal';
import RedactedPhone from './RedactedPhone';
import VisitNotes from './VisitNotes';
import AuthContext from '../contexts/AuthContext';
import { canEditWarehouse } from '../utils/warehousePermissions';
import WarehouseProximityFields from './WarehouseProximityFields';
import { useViewport } from '../hooks/useViewport';
import { downloadAllImages, ERROR_MESSAGES, isMobileBrowser } from '../utils/imageDownloadUtils';
import { showSuccessMessage, showErrorNotification } from '../utils/errorHandler';
import { getMediaFromWarehouse, groupImagesByClassification } from '../utils/mediaUtils';
import { imageLabelService } from '../services/imageLabelService';
import { buildCoordMapsLink } from '../utils/mapsLink';
import { formatHandover } from '../utils/handover';
import { formatAvailabilityReview } from '../utils/availabilityReview';
import { waterSupplyToLabel } from '../utils/waterSupply';
import { suitableForLabels } from '../utils/suitableFor';
import './ResponsiveModal.css';
import './WarehouseForm.css';

// ── Shared inline styles (mirror WarehouseForm) ───────────────────────────────

const labelStyle = (mobile) => ({
  display: 'block',
  marginBottom: 6,
  fontSize: mobile ? 13 : 14,
  fontWeight: 500,
  color: 'var(--text-muted, #8c8c8c)',
  textTransform: mobile ? 'uppercase' : 'none',
  letterSpacing: mobile ? 0.5 : 0,
});
const valueBase = (mobile) => ({
  width: '100%',
  minHeight: mobile ? 44 : 36,
  padding: mobile ? '10px 0' : '6px 0',
  fontSize: mobile ? 16 : 14,
  background: 'transparent',
  border: 'none',
  color: 'var(--text-primary, #fff)',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});
const textAreaValueBase = (mobile) => ({
  ...valueBase(mobile),
  minHeight: mobile ? 'auto' : 'auto',
  display: 'block',
  lineHeight: 1.5,
  padding: mobile ? '10px 0' : '6px 0',
});
const sectionTitle = { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '24px 0 16px' };

// ── Reusable read-only field components ───────────────────────────────────────

const Field = ({ label, children, style, mobile, fieldKey, reviewKey = fieldKey }) => {
  const flags = useContext(FieldReviewHighlightContext);
  const flagged = flags.has(reviewKey);
  const reviewNote = flags.get(reviewKey);
  return <div className={'fr-flag-field' + (flagged ? ' fr-flag-field--active' : '')}
    data-review-field={reviewKey} style={{ marginBottom: 20, ...style }}>
    <div className="fr-field-heading">
      {label && <label style={labelStyle(mobile)}>{label}</label>}
      {flagged && <Tag className="fr-field-marker" color="orange" icon={<FlagOutlined aria-hidden="true" />}
        aria-label={label + ' is flagged for review'}>Flagged for review</Tag>}
    </div>
    {children}
    {flagged && typeof reviewNote === 'string' && reviewNote.trim() && <div className="fr-field-note" role="note" aria-label={label + ' review note'}>
      <strong>Review note</strong>
      <p>{reviewNote}</p>
    </div>}
    <FieldReviewSelection fieldKey={fieldKey} label={label} />
  </div>;
};

const renderRaw = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '-';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
};

const TextValue = ({ value, mobile }) => (
  <div style={valueBase(mobile)}>{renderRaw(value)}</div>
);

const TextAreaValue = ({ value, mobile }) => (
  <div style={textAreaValueBase(mobile)}>{renderRaw(value)}</div>
);

const Section = ({ title, children }) => (
  <div>
    <div style={sectionTitle}>{title}</div>
    {children}
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const getFileNameFromUrl = (url) => {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop();
    return name || url;
  } catch {
    return url.split('/').pop() || url;
  }
};

const formatIST = (v) => {
  if (v === null || v === undefined || v === '') return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }) + ' IST';
};

const formatDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ── Main Component ────────────────────────────────────────────────────────────

const WarehouseDetailsModal = ({
  visible = false,
  onClose,
  warehouse = null,
  footerActions = null, // optional extra footer buttons (e.g. review-queue revoke/reopen)
  enableFieldReview = true,
  statusBanner = null,  // optional banner rendered at the top (e.g. review provenance)
}) => {
  const { user } = useContext(AuthContext) || {};
  const creation = useFieldReviewCreation({warehouse, visible, onClose, enabled: enableFieldReview});
  const reviewHighlights = useFieldReviewHighlights({ warehouse, warehouseId: warehouse?.id, visible, user });
  const flaggedFields = reviewHighlights.fields;
  const { isMobile } = useViewport();
  const m = isMobile;
  const [isDownloading, setIsDownloading] = useState(false);
  // Tagged with the id it belongs to: this modal stays mounted and its
  // `warehouse` prop swaps underneath it, so untagged state would briefly group
  // the new warehouse's images by the previous one's labels.
  const [fetched, setFetched] = useState({ id: null, labels: undefined });

  // Declared above the `!warehouse` early return to keep hook order stable.
  //
  // This modal is also used by the review queue, where `warehouse` is a STAGED
  // row whose `id` is a uuid string, not a Warehouse id. Labels only exist for
  // promoted warehouses, so resolve a numeric id — falling back to the staged
  // row's `warehouseId` (set once approved) — and skip the lookup entirely when
  // there isn't one, rather than firing a request that can only 400.
  const numericId = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const warehouseId = numericId(warehouse?.id) ?? numericId(warehouse?.warehouseId);

  // Resolved during render, never in an effect. Effects run after paint, so
  // anything fetched there is at least one frame too late and shows up as a
  // flat-then-segmented reflow.
  //
  // Preference order:
  //   1. labels the list already delivered on the row (the common path — free)
  //   2. labels cached from a previous open
  //   3. a lookup, for callers that did not ask the list for labels (review queue)
  const rowLabels = warehouse?.imageLabels;
  const cachedLabels = rowLabels ?? (warehouseId ? imageLabelService.getCached(warehouseId) : undefined);
  const imageLabels = cachedLabels ?? (fetched.id === warehouseId ? fetched.labels : undefined);

  useEffect(() => {
    // Already have them: no request at all.
    if (!visible || !warehouseId || cachedLabels !== undefined) return undefined;

    let cancelled = false;
    imageLabelService
      .getForWarehouse(warehouseId)
      .then((labels) => { if (!cancelled) setFetched({ id: warehouseId, labels }); })
      // Deliberately silent: labels are a nicety, and a toast here would be
      // noise on a modal that is already showing every image correctly.
      .catch(() => { if (!cancelled) setFetched({ id: warehouseId, labels: undefined }); });

    return () => { cancelled = true; };
  }, [visible, warehouseId, cachedLabels]);

  if (!warehouse) return null;

  const wd = warehouse.WarehouseData || warehouse.warehouseData || {};
  const coordMapsLink = buildCoordMapsLink(wd.latitude, wd.longitude);
  const media = getMediaFromWarehouse(warehouse);
  const imageRecords = warehouse.images ?? imageLabelService.getCachedImages?.(warehouseId);
  const imageUrls = media.images || [];
  const videoUrls = media.videos || [];
  const docUrls = media.docs || [];
  const hasMedia = imageUrls.length + videoUrls.length + docUrls.length > 0;

  // ── Layout helpers (mirror WarehouseForm) ──────────────────────────────
  const row = (children) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 0 : 16 }}>
      {children}
    </div>
  );
  const col = (children, half = false) => (
    <div style={{ width: (half && !m) ? 'calc(50% - 8px)' : '100%' }}>
      {children}
    </div>
  );

  // ── Image sections ─────────────────────────────────────────────────────
  // null until labels arrive, and null forever if they never do or if every
  // image lands in one bucket — either way the plain gallery renders instead.
  const imageSections = groupImagesByClassification(imageUrls, imageLabels);

  const renderImageGrid = (urls) => (
    <div style={{
      display: 'grid',
      gap: 10,
      gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
    }}>
      {urls.map((url) => (
        <ImageWithFallback
          as={Image}
          // Keyed by URL, not index: sectioning reorders images, and an index
          // key would make React reuse the wrong <img> across a re-group.
          key={url}
          originalUrl={url}
          variantUrl={imageVariant(imageRecords, url)}
          alt={`Warehouse ${warehouse.id} - ${imageLabels?.[url]?.description || 'Image'}`}
          title={imageLabels?.[url]?.description || undefined}
          crossOrigin="anonymous"
          style={{
            width: '100%',
            height: m ? 130 : 120,
            objectFit: 'cover',
            borderRadius: 8,
            cursor: 'pointer',
            border: '1px solid var(--border-primary)',
          }}
          preview={{
            mask: 'Preview',
            maskClassName: 'warehouse-image-preview',
            toolbarRender: previewToolbar,
          }}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23282828'/%3E%3Ctext x='50' y='54' text-anchor='middle' fill='%23666' font-size='11'%3ENo Image%3C/text%3E%3C/svg%3E"
        />
      ))}
    </div>
  );

  // ── Download handler ───────────────────────────────────────────────────
  const handleDownloadAllImages = async () => {
    if (imageUrls.length === 0) {
      showErrorNotification(
        { message: ERROR_MESSAGES.NO_IMAGES },
        { title: 'Download Failed', duration: 4 }
      );
      return;
    }

    const isMobileDevice = isMobileBrowser();
    if (isMobileDevice && imageUrls.length > 3) {
      showSuccessMessage('info', {
        details: ERROR_MESSAGES.MOBILE_FALLBACK,
        duration: 6,
      });
    }

    setIsDownloading(true);
    try {
      const results = await downloadAllImages(imageUrls, warehouse.id);
      setIsDownloading(false);

      if (results.successful === results.total) {
        const message = results.usedFallback
          ? `Processed ${results.successful} image${results.successful > 1 ? 's' : ''}. Some opened in new tabs.`
          : `Downloaded ${results.successful} image${results.successful > 1 ? 's' : ''}`;
        showSuccessMessage('download', { details: message, duration: 4 });
      } else if (results.successful > 0) {
        let description = ERROR_MESSAGES.PARTIAL_FAILURE(results.successful, results.total, results.failed);
        if (results.usedFallback) description += '\nSome images opened in new tabs.';
        if (results.errors.some(e => e.error.toLowerCase().includes('cors'))) {
          description += `\n${ERROR_MESSAGES.CORS_ERROR}`;
        }
        showErrorNotification({ message: description }, { title: 'Partial Download', duration: 8, showDetails: true });
      } else {
        const hasCors = results.errors.some(e => e.error.toLowerCase().includes('cors'));
        const hasNet = results.errors.some(e => e.error.toLowerCase().includes('network'));
        const msg = hasCors ? ERROR_MESSAGES.CORS_ERROR : hasNet ? ERROR_MESSAGES.NETWORK_ERROR : ERROR_MESSAGES.COMPLETE_FAILURE;
        showErrorNotification({ message: msg }, { title: 'Download Failed', duration: 8, showDetails: true });
      }
    } catch (error) {
      setIsDownloading(false);
      showErrorNotification(
        { message: error.message || ERROR_MESSAGES.COMPLETE_FAILURE },
        { title: 'Download Error', duration: 8 }
      );
    }
  };

  // ── Image preview toolbar ──────────────────────────────────────────────
  const previewToolbar = (_, { actions: { onRotateLeft, onRotateRight, onZoomOut, onZoomIn, onReset } }) => (
    <Space size={12} className="toolbar-wrapper">
      {[
        { icon: <ZoomInOutlined />, action: onZoomIn, title: 'Zoom In' },
        { icon: <ZoomOutOutlined />, action: onZoomOut, title: 'Zoom Out' },
        { icon: <RotateLeftOutlined />, action: onRotateLeft, title: 'Rotate Left' },
        { icon: <RotateRightOutlined />, action: onRotateRight, title: 'Rotate Right' },
        { icon: <UndoOutlined />, action: onReset, title: 'Reset' },
      ].map(({ icon, action, title }) => (
        <Button
          key={title}
          type="text"
          icon={icon}
          onClick={action}
          style={{ color: '#fff', minHeight: 44, minWidth: 44 }}
          title={title}
        />
      ))}
    </Space>
  );

  const actions = (
    <div style={{
      marginTop: m ? 0 : 32,
      display: 'flex',
      flexDirection: m ? 'column' : 'row',
      justifyContent: 'flex-end',
      gap: 12,
    }}>
      {footerActions && (
        <div style={{ display: m ? 'grid' : 'flex', gridAutoFlow: m ? 'column' : undefined, gridAutoColumns: m ? 'minmax(0, 1fr)' : undefined, flexWrap: 'wrap', gap: 12, marginRight: m ? 0 : 'auto' }}>
          {footerActions}
        </div>
      )}
      <Button size="large" onClick={creation.onClose}
        style={{ minWidth: 120, minHeight: m ? 44 : 'auto', height: 'auto', whiteSpace: 'normal' }}>
        Close
      </Button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <FieldReviewHighlightContext.Provider value={flaggedFields}>
    <FieldReviewSelectionContext.Provider value={creation.selection}>
    <ResponsiveModal
      visible={visible}
      onClose={creation.onClose}
      title={`Warehouse #${warehouse.id}`}
      maxWidth="900px"
      className="warehouse-details-modal"
      footer={m ? actions : undefined}
    >
      <div style={{ color: 'var(--text-primary)' }}>

        {creation.toolbar}
        {statusBanner && <div style={{ marginBottom: 16 }}>{statusBanner}</div>}
        {reviewHighlights.loading && <div className="fr-review-loading" role="status" aria-live="polite">
          <Spin size="small" aria-hidden="true" />
          <span>{reviewHighlights.refreshing ? 'Refreshing' : 'Loading'} review flags and notes…</span>
        </div>}
        {reviewHighlights.error && <Alert type="warning" showIcon message="Review flags could not be refreshed."
          action={<Button size="small" onClick={reviewHighlights.refresh}>Retry field flags</Button>} />}
        {flaggedFields.size > 0 && <p className="fr-view-flags" role="status"><FlagOutlined aria-hidden="true" />
          {' '}{flaggedFields.size} flagged {flaggedFields.size === 1 ? 'field is' : 'fields are'} highlighted below.
        </p>}

        {/* ── Owner Details ───────────────────────────────────── */}
        <Section title="Owner Details">
          {row(<>
            {col(<Field fieldKey="listing_type" label="Listing Type" mobile={m}><TextValue mobile={m} value={warehouse.listing_type} /></Field>, true)}
            {col(<Field fieldKey="warehouseOwnerType" label="Warehouse Owner Type" mobile={m}><TextValue mobile={m} value={warehouse.warehouseOwnerType} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="ownerCompanyName" label="Owner Company Name" mobile={m}><TextValue mobile={m} value={warehouse.ownerCompanyName} /></Field>, true)}
            {col(
              <Field fieldKey="contactPerson" label="Contact Person" mobile={m}>
                <TextValue mobile={m} value={warehouse.contactPerson} />
              </Field>,
            true)}
          </>)}

          {row(<>
            {col(
              <Field fieldKey="contactNumber" label="Contact Number" mobile={m}>
                <div style={valueBase(m)}>
                  <RedactedPhone warehouseId={warehouse.id} contactNumber={warehouse.contactNumber} />
                </div>
              </Field>,
            true)}
            {col(<Field fieldKey="alt_phone_number" label="Alternate Phone Number" mobile={m}><TextValue mobile={m} value={warehouse.alt_phone_number} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="ownerAltPoc" label="Owner Alternate POC" mobile={m}><TextValue mobile={m} value={warehouse.ownerAltPoc} /></Field>, true)}
            {col(<Field fieldKey="isBroker" label="Is Broker" mobile={m}><TextValue mobile={m} value={warehouse.isBroker} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="is_builder" label="Is Builder" mobile={m}><TextValue mobile={m} value={warehouse.is_builder} /></Field>, true)}
            {col(<Field fieldKey="owner_warmnth" label="Owner Warmth" mobile={m}><TextValue mobile={m} value={warehouse.owner_warmnth} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="owner_of_multiple_sites" label="Owner of Multiple Sites" mobile={m}><TextValue mobile={m} value={warehouse.owner_of_multiple_sites} /></Field>, true)}
            {col(<Field label="Uploaded By" mobile={m}><TextValue mobile={m} value={warehouse.uploadedBy} /></Field>, true)}
          </>)}
        </Section>

        {/* ── Availability ────────────────────────────────────── */}
        <Section title="Availability">
          {row(<>
            {col(<Field fieldKey="availabilityReview" label="Availability" mobile={m}><TextValue mobile={m} value={warehouse.availability} /></Field>, true)}
            {col(<Field reviewKey="availabilityReview" label="Availability last reviewed" mobile={m}><TextValue mobile={m} value={formatAvailabilityReview(warehouse.availabilityLastReviewedOn)} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="handover" label="Handover" mobile={m}><TextValue mobile={m} value={formatHandover(warehouse, formatDate)} /></Field>, true)}
            {col(<Field fieldKey="lockInDate" label="Lock-in Date" mobile={m}><TextValue mobile={m} value={formatDate(warehouse.lockInDate)} /></Field>, true)}
          </>)}
          {row(col(<Field fieldKey="status" label="Status" mobile={m}><TextValue mobile={m} value={warehouse.status} /></Field>, true))}
        </Section>

        {/* ── Location Details ────────────────────────────────── */}
        <Section title="Location Details">
          <Field fieldKey="address" label="Address" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.address} />
          </Field>

          {row(<>
            {col(<Field fieldKey="city" label="City" mobile={m}><TextValue mobile={m} value={warehouse.city} /></Field>, true)}
            {col(<Field fieldKey="state" label="State" mobile={m}><TextValue mobile={m} value={warehouse.state} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="postalCode" label="Postal Code" mobile={m}><TextValue mobile={m} value={warehouse.postalCode} /></Field>, true)}
            {col(<Field fieldKey="zone" label="Zone" mobile={m}><TextValue mobile={m} value={warehouse.zone} /></Field>, true)}
          </>)}

          {/* Derived server-side from the coordinates, never entered by hand. */}
          <Field label="Micro Market" mobile={m}>
            <TextValue mobile={m} value={warehouse.micromarket} />
          </Field>

          <Field fieldKey="googleLocation" label="Google Location URL" mobile={m}>
            {warehouse.googleLocation ? (
              <a
                href={warehouse.googleLocation}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...valueBase(m), color: 'var(--link-color, #4ea1f5)', textDecoration: 'none', cursor: 'pointer' }}
              >
                {warehouse.googleLocation} <ExportOutlined aria-hidden="true" style={{ marginLeft: 4, flexShrink: 0 }} />
              </a>
            ) : (
              <TextValue mobile={m} value={warehouse.googleLocation} />
            )}
          </Field>

          {/* Coordinate-only fallback — the pasted link above often fails on Apple devices. */}
          <Field label="Alternative Maps Link (from coordinates)" mobile={m}>
            {coordMapsLink ? (
              <a
                href={coordMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...valueBase(m), color: 'var(--link-color, #4ea1f5)', textDecoration: 'none', cursor: 'pointer' }}
              >
                {coordMapsLink} <ExportOutlined aria-hidden="true" style={{ marginLeft: 4, flexShrink: 0 }} />
              </a>
            ) : (
              <TextValue mobile={m} value={null} />
            )}
          </Field>

          {row(<>
            {col(<Field fieldKey="warehouseData.latitude" label="Latitude" mobile={m}><TextValue mobile={m} value={wd.latitude} /></Field>, true)}
            {col(<Field fieldKey="warehouseData.longitude" label="Longitude" mobile={m}><TextValue mobile={m} value={wd.longitude} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="nearest_transport" label="Nearest Bus Transport" mobile={m}><TextValue mobile={m} value={warehouse.nearest_transport} /></Field>, true)}
            {col(<Field fieldKey="distance_from_highway" label="Distance from Highway" mobile={m}><TextValue mobile={m} value={warehouse.distance_from_highway} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="warehouseData.approachRoadWidth" label="Approach Road Width" mobile={m}><TextValue mobile={m} value={withDefaultUnit(wd.approachRoadWidth, 'ft')} /></Field>, true)}
            {col(<Field fieldKey="warehouseData.landType" label="Land Type" mobile={m}><TextValue mobile={m} value={wd.landType} /></Field>, true)}
          </>)}

          {row(
            col(<Field fieldKey="warehouseData.pollutionZone" label="Pollution Zone" mobile={m}><TextValue mobile={m} value={wd.pollutionZone} /></Field>, true)
          )}
        </Section>

        {/* ── Warehouse Technical Specifications ──────────────── */}
        <Section title="Warehouse Technical Specifications">
          {row(
            col(<Field fieldKey="warehouseType" label="Warehouse Type" mobile={m}><TextValue mobile={m} value={warehouse.warehouseType} /></Field>, true)
          )}

          {/* Keep flagged RCC/lift fields visible even if their parent values changed. */}
          {(warehouse.warehouseType === 'RCC' || ['totalFloors', 'liftAccess', 'passengerLiftCount', 'serviceLiftCount', 'liftLoadCapacity'].some(key => flaggedFields.has(key))) && (<>
            {row(<>
              {col(<Field fieldKey="totalFloors" label="Total Number of Floors" mobile={m}><TextValue mobile={m} value={warehouse.totalFloors} /></Field>, true)}
              {col(<Field fieldKey="liftAccess" label="Lift Access" mobile={m}><TextValue mobile={m} value={warehouse.liftAccess === true ? 'Yes' : warehouse.liftAccess === false ? 'No' : '-'} /></Field>, true)}
            </>)}

            {(warehouse.liftAccess === true || ['passengerLiftCount', 'serviceLiftCount', 'liftLoadCapacity'].some(key => flaggedFields.has(key))) && (<>
              {row(<>
                {col(<Field fieldKey="passengerLiftCount" label="Number of Passenger Lifts" mobile={m}><TextValue mobile={m} value={warehouse.passengerLiftCount} /></Field>, true)}
                {col(<Field fieldKey="serviceLiftCount" label="Number of Service Lifts" mobile={m}><TextValue mobile={m} value={warehouse.serviceLiftCount} /></Field>, true)}
              </>)}

              {row(
                col(<Field fieldKey="liftLoadCapacity" label="Lift Load Capacity" mobile={m}><TextValue mobile={m} value={warehouse.liftLoadCapacity} /></Field>, true)
              )}
            </>)}
          </>)}

          {row(<>
            {col(
              /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
              <Field fieldKey="totalSpaceSqft" label={warehouse.warehouseType === 'RCC' ? 'Offered Area per Floor (sq ft)' : 'Offered Area (sq ft)'} mobile={m}>
                <TextValue mobile={m} value={warehouse.totalSpaceSqft} />
              </Field>,
            true)}
            {col(<Field fieldKey="chargeableArea" label="Chargeable Area (sq ft)" mobile={m}><TextValue mobile={m} value={warehouse.chargeableArea} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="land_parcel_size" label="Land Parcel Size" mobile={m}><TextValue mobile={m} value={warehouse.land_parcel_size} /></Field>, true)}
            {col(<Field fieldKey="builtup_area" label="Built-up Area" mobile={m}><TextValue mobile={m} value={warehouse.builtup_area} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="carpet_area" label="Carpet Area" mobile={m}><TextValue mobile={m} value={warehouse.carpet_area} /></Field>, true)}
            {col(<Field fieldKey="warehouseData.dimensions" label="Dimensions" mobile={m}><TextValue mobile={m} value={wd.dimensions} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="clearHeightFt" label="Clear Height" mobile={m}><TextValue mobile={m} value={withDefaultUnit(warehouse.clearHeightFt, 'ft')} /></Field>, true)}
            {col(<Field fieldKey="centreHeight" label="Centre Height" mobile={m}><TextValue mobile={m} value={warehouse.centreHeight} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="plinthHeightFt" label="Plinth Height" mobile={m}><TextValue mobile={m} value={withDefaultUnit(warehouse.plinthHeightFt, 'ft')} /></Field>, true)}
            {col(<Field fieldKey="numberOfDocks" label="Number of Docks" mobile={m}><TextValue mobile={m} value={warehouse.numberOfDocks} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="dockDimension" label="Dock Dimension" mobile={m}><TextValue mobile={m} value={warehouse.dockDimension} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="dockApronLengthFt" label="Dock Apron Length" mobile={m}><TextValue mobile={m} value={withDefaultUnit(warehouse.dockApronLengthFt, 'ft')} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="dockPlatformType" label="Dock Platform Type" mobile={m}><TextValue mobile={m} value={warehouse.dockPlatformType} /></Field>, true)}
            {col(<Field fieldKey="gateSizeFt" label="Compound Gate Width" mobile={m}><TextValue mobile={m} value={withDefaultUnit(warehouse.gateSizeFt, 'ft')} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="setbackArea" label="Setback Area" mobile={m}><TextValue mobile={m} value={warehouse.setbackArea} /></Field>, true)}
            {col(<Field fieldKey="ccRoads" label="Paved Roads inside Warehouse?" mobile={m}><TextValue mobile={m} value={warehouse.ccRoads} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="wallAndSecurityRoom" label="Security Features" mobile={m}><TextValue mobile={m} value={warehouse.wallAndSecurityRoom} /></Field>, true)}
            {col(<Field fieldKey="canopyType" label="Canopy Type" mobile={m}><TextValue mobile={m} value={warehouse.canopyType} /></Field>, true)}
          </>)}

          <Field fieldKey="otherDockingSpecs" label="Other Docking Specs" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.otherDockingSpecs} />
          </Field>

          {row(<>
            {col(<Field fieldKey="flooringType" label="Flooring Type" mobile={m}><TextValue mobile={m} value={warehouse.flooringType} /></Field>, true)}
            {col(<Field fieldKey="floorStrengthPerSqm" label="Floor Strength" mobile={m}><TextValue mobile={m} value={warehouse.floorStrengthPerSqm} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="ventilationType" label="Ventilation Type" mobile={m}><TextValue mobile={m} value={warehouse.ventilationType} /></Field>, true)}
            {col(<Field fieldKey="ventilationAirChangesPerDay" label="Ventilation Air Changes/Day" mobile={m}><TextValue mobile={m} value={warehouse.ventilationAirChangesPerDay} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="insulationPresent" label="Insulation Present" mobile={m}><TextValue mobile={m} value={warehouse.insulationPresent} /></Field>, true)}
            {col(<Field fieldKey="insulationType" label="Insulation Type" mobile={m}><TextValue mobile={m} value={warehouse.insulationType} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field fieldKey="lightingDetails" label="Lighting" mobile={m}><TextValue mobile={m} value={warehouse.lightingDetails} /></Field>, true)}
            {col(<Field fieldKey="washroom_count" label="Washroom Count" mobile={m}><TextValue mobile={m} value={warehouse.washroom_count} /></Field>, true)}
          </>)}

          <Field fieldKey="warehouseData.parkingDockingSpace" label="Parking Space Availability" mobile={m}>
            <TextAreaValue mobile={m} value={wd.parkingDockingSpace} />
          </Field>

          {row(<>
            {col(<Field fieldKey="warehouseData.powerKva" label="Power" mobile={m}><TextValue mobile={m} value={withDefaultUnit(wd.powerKva, 'kVA')} /></Field>, true)}
            {col(<Field fieldKey="waterSupply" label="Water Supply" mobile={m}><TextValue mobile={m} value={waterSupplyToLabel(warehouse.waterSupply) || '-'} /></Field>, true)}
          </>)}

          {/* Tags rather than a comma-joined string: the values are a set, and
              chips make it obvious where one ends and the next begins. */}
          <Field fieldKey="suitableFor" label="Suitable For" mobile={m}>
            {suitableForLabels(warehouse.suitableFor).length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: m ? '10px 0' : '6px 0' }}>
                {suitableForLabels(warehouse.suitableFor).map((label) => (
                  <Tag key={label} style={{ margin: 0 }}>{label}</Tag>
                ))}
              </div>
            ) : (
              <TextValue mobile={m} value="-" />
            )}
          </Field>

          <Field fieldKey="otherSpecifications" label="Other Specifications" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.otherSpecifications} />
          </Field>
        </Section>

        {/* ── Compliances ─────────────────────────────────────── */}
        <Section title="Compliances">
          <Field fieldKey="compliances" label="Compliances" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.compliances} />
          </Field>

          {row(<>
            {col(<Field fieldKey="fire_exits" label="Fire Exits" mobile={m}><TextValue mobile={m} value={warehouse.fire_exits} /></Field>, true)}
            {col(<Field fieldKey="warehouseData.fireNocAvailable" label="Fire NOC Available" mobile={m}><TextValue mobile={m} value={wd.fireNocAvailable} /></Field>, true)}
          </>)}

          {row(
            col(<Field fieldKey="warehouseData.fireSafetyMeasures" label="Fire Safety Measures" mobile={m}><TextValue mobile={m} value={wd.fireSafetyMeasures} /></Field>, true)
          )}

          {row(<>
            {col(<Field fieldKey="fire_compliance_cert_type" label="Fire Compliance Certification Type" mobile={m}><TextValue mobile={m} value={warehouse.fire_compliance_cert_type} /></Field>, true)}
            {col(<Field fieldKey="warehouseData.vaastuCompliance" label="Vaastu Compliance" mobile={m}><TextValue mobile={m} value={wd.vaastuCompliance} /></Field>, true)}
          </>)}

          {row(
            col(<Field label="WOG Verified" mobile={m}><TextValue mobile={m} value={warehouse.wogVerified === true ? 'Yes' : warehouse.wogVerified === false ? 'No' : '-'} /></Field>, true)
          )}
        </Section>

        {/* ── Commercials ─────────────────────────────────────── */}
        <Section title="Commercials">
          {row(<>
            {col(<Field fieldKey="ratePerSqft" label="Rate per sq ft" mobile={m}><TextValue mobile={m} value={warehouse.ratePerSqft} /></Field>, true)}
            {col(<Field fieldKey="negotiated_rent" label="Negotiated Rent" mobile={m}><TextValue mobile={m} value={warehouse.negotiated_rent} /></Field>, true)}
          </>)}

          {row(
            col(<Field fieldKey="cam" label="CAM" mobile={m}><TextValue mobile={m} value={warehouse.cam} /></Field>, true)
          )}
        </Section>

        {visible && <WarehouseProximityFields warehouse={warehouse} />}

        {/* ── Metadata (incl. media) ──────────────────────────── */}
        <Section title="Metadata">
          {row(
            col(<Field label="Last edited by" mobile={m}><TextValue mobile={m} value={warehouse.lastEditedBy} /></Field>, true)
          )}
          {row(<>
            {col(<Field label="Visibility" mobile={m}><TextValue mobile={m} value={warehouse.visibility} /></Field>, true)}
            {col(<Field label="ID" mobile={m}><TextValue mobile={m} value={warehouse.id} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Created At" mobile={m}><TextValue mobile={m} value={formatIST(warehouse.createdAt)} /></Field>, true)}
            {col(<Field label="Status Updated At" mobile={m}><TextValue mobile={m} value={formatIST(warehouse.status_updated_at)} /></Field>, true)}
          </>)}

          <Field fieldKey="media" label="Media section" mobile={m}>
            <p className="fr-help">{hasMedia ? `${imageUrls.length} images · ${videoUrls.length} videos · ${docUrls.length} documents` : 'No media uploaded'}</p>
          </Field>
          {!hasMedia && (
            <Field label="Uploaded Files" mobile={m}>
              <TextValue mobile={m} value="-" />
            </Field>
          )}

          {imageUrls.length > 0 && (
            <Field label={`Images (${imageUrls.length})`} mobile={m}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadAllImages}
                  loading={isDownloading}
                  style={{ fontSize: 12 }}
                >
                  {isDownloading ? 'Downloading...' : 'Download All'}
                </Button>
              </div>
              {/* One PreviewGroup around everything, so arrowing through the
                  lightbox still walks the whole set even when it is split into
                  sections on the page. */}
              <Image.PreviewGroup>
                {imageSections
                  ? imageSections.map((section) => (
                      <div key={section.key} style={{ marginBottom: 18 }}>
                        <div style={{
                          fontSize: m ? 12 : 13,
                          fontWeight: 600,
                          color: 'var(--text-muted, #8c8c8c)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          marginBottom: 8,
                        }}>
                          {section.title} ({section.urls.length})
                        </div>
                        {renderImageGrid(section.urls)}
                      </div>
                    ))
                  : renderImageGrid(imageUrls)}
              </Image.PreviewGroup>
            </Field>
          )}

          {videoUrls.length > 0 && (
            <Field label={`Videos (${videoUrls.length})`} mobile={m}>
              <div style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: m ? '1fr' : 'repeat(2, 1fr)',
              }}>
                {videoUrls.map((url, i) => (
                  <div key={i} style={{
                    position: 'relative',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border-primary)',
                    background: '#000',
                  }}>
                    <video
                      src={url}
                      controls
                      preload="metadata"
                      style={{ width: '100%', height: m ? 180 : 200, objectFit: 'contain', background: '#000' }}
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'var(--bg-card)',
                    }}>
                      <PlayCircleOutlined />
                      {getFileNameFromUrl(url)}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          )}

          {docUrls.length > 0 && (
            <Field label={`Documents (${docUrls.length})`} mobile={m}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid var(--border-primary)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 500,
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  >
                    <div style={{
                      width: 32, height: 32,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, background: 'var(--bg-surface)', flexShrink: 0,
                    }}>
                      <FileTextOutlined style={{ fontSize: 14, color: 'var(--text-muted)' }} />
                    </div>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getFileNameFromUrl(url)}
                    </span>
                    <LinkOutlined style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </Field>
          )}

        </Section>

        {/* ── Scout Notes ─────────────────────────────────────── */}
        <Section title="Scout Notes">
          <VoiceNotesList key={String(warehouse.id)} recordId={warehouse.id} notes={warehouse.scoutVoiceNotes} />
          <Field fieldKey="scoutNotes" label="Notes" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.scoutNotes} />
          </Field>
        </Section>

        {/* ── Visit Notes (master warehouses only — staged rows have uuid ids) ── */}
        {typeof warehouse.id === 'number' && (
          <Section title="Visit Notes">
            <VisitNotes warehouseId={warehouse.id} editable={canEditWarehouse(user, warehouse)} />
          </Section>
        )}

        {/* ── Actions ─────────────────────────────────────────── */}
        {!m && actions}
      </div>
    </ResponsiveModal>
    {creation.summary}
    </FieldReviewSelectionContext.Provider>
    </FieldReviewHighlightContext.Provider>
  );
};

export default WarehouseDetailsModal;
