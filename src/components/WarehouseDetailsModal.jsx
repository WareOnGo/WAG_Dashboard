import { useState } from 'react';
import { Image, Space, Button } from 'antd';
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
} from '@ant-design/icons';
import ResponsiveModal from './ResponsiveModal';
import RedactedPhone from './RedactedPhone';
import { useViewport } from '../hooks/useViewport';
import { downloadAllImages, ERROR_MESSAGES, isMobileBrowser } from '../utils/imageDownloadUtils';
import { showSuccessMessage, showErrorNotification } from '../utils/errorHandler';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import './ResponsiveModal.css';
import './WarehouseForm.css';

// ── Shared inline styles (mirror WarehouseForm) ───────────────────────────────

const labelStyle = (mobile) => ({
  display: 'block',
  marginBottom: 6,
  fontSize: mobile ? 13 : 14,
  fontWeight: 500,
  color: 'var(--text-muted, #8c8c8c)',
  opacity: 0.75,
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

const Field = ({ label, children, style, mobile }) => (
  <div style={{ marginBottom: 20, ...style }}>
    {label && (
      <label style={labelStyle(mobile)}>{label}</label>
    )}
    {children}
  </div>
);

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
}) => {
  const { isMobile } = useViewport();
  const m = isMobile;
  const [isDownloading, setIsDownloading] = useState(false);

  if (!warehouse) return null;

  const wd = warehouse.WarehouseData || warehouse.warehouseData || {};
  const media = getMediaFromWarehouse(warehouse);
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

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      title={`Warehouse #${warehouse.id}`}
      maxWidth="900px"
      className="warehouse-details-modal"
    >
      <div style={{ color: 'var(--text-primary)' }}>

        {/* ── Owner Details ───────────────────────────────────── */}
        <Section title="Owner Details">
          {row(<>
            {col(<Field label="Listing Type" mobile={m}><TextValue mobile={m} value={warehouse.listing_type} /></Field>, true)}
            {col(<Field label="Warehouse Owner Type" mobile={m}><TextValue mobile={m} value={warehouse.warehouseOwnerType} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Owner Company Name" mobile={m}><TextValue mobile={m} value={warehouse.ownerCompanyName} /></Field>, true)}
            {col(
              <Field label="Contact Person" mobile={m}>
                <TextValue mobile={m} value={warehouse.contactPerson} />
              </Field>,
            true)}
          </>)}

          {row(<>
            {col(
              <Field label="Contact Number" mobile={m}>
                <div style={valueBase(m)}>
                  <RedactedPhone warehouseId={warehouse.id} />
                </div>
              </Field>,
            true)}
            {col(<Field label="Alternate Phone Number" mobile={m}><TextValue mobile={m} value={warehouse.alt_phone_number} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Owner Alternate POC" mobile={m}><TextValue mobile={m} value={warehouse.ownerAltPoc} /></Field>, true)}
            {col(<Field label="Is Broker" mobile={m}><TextValue mobile={m} value={warehouse.isBroker} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Is Builder" mobile={m}><TextValue mobile={m} value={warehouse.is_builder} /></Field>, true)}
            {col(<Field label="Owner Warmth" mobile={m}><TextValue mobile={m} value={warehouse.owner_warmnth} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Owner of Multiple Sites" mobile={m}><TextValue mobile={m} value={warehouse.owner_of_multiple_sites} /></Field>, true)}
            {col(<Field label="Uploaded By" mobile={m}><TextValue mobile={m} value={warehouse.uploadedBy} /></Field>, true)}
          </>)}
        </Section>

        {/* ── Availability ────────────────────────────────────── */}
        <Section title="Availability">
          {row(<>
            {col(<Field label="Availability" mobile={m}><TextValue mobile={m} value={warehouse.availability} /></Field>, true)}
            {col(<Field label="Status" mobile={m}><TextValue mobile={m} value={warehouse.status} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Handover Date" mobile={m}><TextValue mobile={m} value={formatDate(warehouse.handoverDate)} /></Field>, true)}
            {col(<Field label="Lock-in Date" mobile={m}><TextValue mobile={m} value={formatDate(warehouse.lockInDate)} /></Field>, true)}
          </>)}
        </Section>

        {/* ── Location Details ────────────────────────────────── */}
        <Section title="Location Details">
          <Field label="Address" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.address} />
          </Field>

          {row(<>
            {col(<Field label="City" mobile={m}><TextValue mobile={m} value={warehouse.city} /></Field>, true)}
            {col(<Field label="State" mobile={m}><TextValue mobile={m} value={warehouse.state} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Postal Code" mobile={m}><TextValue mobile={m} value={warehouse.postalCode} /></Field>, true)}
            {col(<Field label="Zone" mobile={m}><TextValue mobile={m} value={warehouse.zone} /></Field>, true)}
          </>)}

          <Field label="Google Location URL" mobile={m}>
            {warehouse.googleLocation ? (
              <a
                href={warehouse.googleLocation}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...valueBase(m), color: '#4ea1f5', textDecoration: 'none', cursor: 'pointer' }}
              >
                {warehouse.googleLocation} ↗
              </a>
            ) : (
              <TextValue mobile={m} value={warehouse.googleLocation} />
            )}
          </Field>

          {row(<>
            {col(<Field label="Latitude" mobile={m}><TextValue mobile={m} value={wd.latitude} /></Field>, true)}
            {col(<Field label="Longitude" mobile={m}><TextValue mobile={m} value={wd.longitude} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Nearest Bus Transport" mobile={m}><TextValue mobile={m} value={warehouse.nearest_transport} /></Field>, true)}
            {col(<Field label="Distance from Highway" mobile={m}><TextValue mobile={m} value={warehouse.distance_from_highway} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Approach Road Width (ft)" mobile={m}><TextValue mobile={m} value={wd.approachRoadWidth} /></Field>, true)}
            {col(<Field label="Land Type" mobile={m}><TextValue mobile={m} value={wd.landType} /></Field>, true)}
          </>)}

          {row(
            col(<Field label="Pollution Zone" mobile={m}><TextValue mobile={m} value={wd.pollutionZone} /></Field>, true)
          )}
        </Section>

        {/* ── Warehouse Technical Specifications ──────────────── */}
        <Section title="Warehouse Technical Specifications">
          {row(<>
            {col(<Field label="Warehouse Type" mobile={m}><TextValue mobile={m} value={warehouse.warehouseType} /></Field>, true)}
            {col(
              /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
              <Field label="Offered Area (sq ft)" mobile={m}>
                <TextValue mobile={m} value={warehouse.totalSpaceSqft} />
              </Field>, 
            true)}
          </>)}

          {row(<>
            {col(<Field label="Land Parcel Size" mobile={m}><TextValue mobile={m} value={warehouse.land_parcel_size} /></Field>, true)}
            {col(<Field label="Built-up Area" mobile={m}><TextValue mobile={m} value={warehouse.builtup_area} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Carpet Area" mobile={m}><TextValue mobile={m} value={warehouse.carpet_area} /></Field>, true)}
            {col(<Field label="Dimensions" mobile={m}><TextValue mobile={m} value={wd.dimensions} /></Field>, true)}
          </>)}

          {row(
            col(<Field label="Chargeable Area (sq ft)" mobile={m}><TextValue mobile={m} value={warehouse.chargeableArea} /></Field>, true)
          )}

          {row(<>
            {col(<Field label="Clear Height (ft)" mobile={m}><TextValue mobile={m} value={warehouse.clearHeightFt} /></Field>, true)}
            {col(<Field label="Centre Height" mobile={m}><TextValue mobile={m} value={warehouse.centreHeight} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Plinth Height (ft)" mobile={m}><TextValue mobile={m} value={warehouse.plinthHeightFt} /></Field>, true)}
            {col(<Field label="Number of Docks" mobile={m}><TextValue mobile={m} value={warehouse.numberOfDocks} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Dock Dimension" mobile={m}><TextValue mobile={m} value={warehouse.dockDimension} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Dock Apron Length (ft)" mobile={m}><TextValue mobile={m} value={warehouse.dockApronLengthFt} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Dock Platform Type" mobile={m}><TextValue mobile={m} value={warehouse.dockPlatformType} /></Field>, true)}
            {col(<Field label="Gate Size (ft)" mobile={m}><TextValue mobile={m} value={warehouse.gateSizeFt} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Setback Area" mobile={m}><TextValue mobile={m} value={warehouse.setbackArea} /></Field>, true)}
            {col(<Field label="CC Roads" mobile={m}><TextValue mobile={m} value={warehouse.ccRoads} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Wall & Security Room" mobile={m}><TextValue mobile={m} value={warehouse.wallAndSecurityRoom} /></Field>, true)}
            {col(<Field label="Canopy Type" mobile={m}><TextValue mobile={m} value={warehouse.canopyType} /></Field>, true)}
          </>)}

          <Field label="Other Docking Specs" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.otherDockingSpecs} />
          </Field>

          {row(<>
            {col(<Field label="Flooring Type" mobile={m}><TextValue mobile={m} value={warehouse.flooringType} /></Field>, true)}
            {col(<Field label="Floor Strength (per sqm)" mobile={m}><TextValue mobile={m} value={warehouse.floorStrengthPerSqm} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Ventilation Type" mobile={m}><TextValue mobile={m} value={warehouse.ventilationType} /></Field>, true)}
            {col(<Field label="Ventilation Air Changes/Day" mobile={m}><TextValue mobile={m} value={warehouse.ventilationAirChangesPerDay} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Insulation Present" mobile={m}><TextValue mobile={m} value={warehouse.insulationPresent} /></Field>, true)}
            {col(<Field label="Insulation Type" mobile={m}><TextValue mobile={m} value={warehouse.insulationType} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Lighting Details" mobile={m}><TextValue mobile={m} value={warehouse.lightingDetails} /></Field>, true)}
            {col(<Field label="Washroom Count" mobile={m}><TextValue mobile={m} value={warehouse.washroom_count} /></Field>, true)}
          </>)}

          <Field label="Parking & Docking Space" mobile={m}>
            <TextAreaValue mobile={m} value={wd.parkingDockingSpace} />
          </Field>

          {row(
            col(<Field label="Power (KVA)" mobile={m}><TextValue mobile={m} value={wd.powerKva} /></Field>, true)
          )}

          <Field label="Other Specifications" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.otherSpecifications} />
          </Field>
        </Section>

        {/* ── Compliances ─────────────────────────────────────── */}
        <Section title="Compliances">
          <Field label="Compliances" mobile={m}>
            <TextAreaValue mobile={m} value={warehouse.compliances} />
          </Field>

          {row(<>
            {col(<Field label="Fire Exits" mobile={m}><TextValue mobile={m} value={warehouse.fire_exits} /></Field>, true)}
            {col(<Field label="Fire NOC Available" mobile={m}><TextValue mobile={m} value={wd.fireNocAvailable} /></Field>, true)}
          </>)}

          {row(
            col(<Field label="Fire Safety Measures" mobile={m}><TextValue mobile={m} value={wd.fireSafetyMeasures} /></Field>, true)
          )}

          {row(<>
            {col(<Field label="Fire Compliance Cert Type" mobile={m}><TextValue mobile={m} value={warehouse.fire_compliance_cert_type} /></Field>, true)}
            {col(<Field label="Vaastu Compliance" mobile={m}><TextValue mobile={m} value={wd.vaastuCompliance} /></Field>, true)}
          </>)}

          {row(
            col(<Field label="WOG Verified" mobile={m}><TextValue mobile={m} value={warehouse.wogVerified === true ? 'Yes' : warehouse.wogVerified === false ? 'No' : '-'} /></Field>, true)
          )}
        </Section>

        {/* ── Commercials ─────────────────────────────────────── */}
        <Section title="Commercials">
          {row(<>
            {col(<Field label="Rate per sq ft" mobile={m}><TextValue mobile={m} value={warehouse.ratePerSqft} /></Field>, true)}
            {col(<Field label="Negotiated Rent" mobile={m}><TextValue mobile={m} value={warehouse.negotiated_rent} /></Field>, true)}
          </>)}

          {row(
            col(<Field label="CAM" mobile={m}><TextValue mobile={m} value={warehouse.cam} /></Field>, true)
          )}
        </Section>

        {/* ── Metadata (incl. media) ──────────────────────────── */}
        <Section title="Metadata">
          {row(<>
            {col(<Field label="Visibility" mobile={m}><TextValue mobile={m} value={warehouse.visibility} /></Field>, true)}
            {col(<Field label="ID" mobile={m}><TextValue mobile={m} value={warehouse.id} /></Field>, true)}
          </>)}

          {row(<>
            {col(<Field label="Created At" mobile={m}><TextValue mobile={m} value={formatIST(warehouse.createdAt)} /></Field>, true)}
            {col(<Field label="Status Updated At" mobile={m}><TextValue mobile={m} value={formatIST(warehouse.status_updated_at)} /></Field>, true)}
          </>)}

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
              <div style={{
                display: 'grid',
                gap: 10,
                gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              }}>
                <Image.PreviewGroup>
                  {imageUrls.map((url, i) => (
                    <Image
                      key={i}
                      src={url}
                      alt={`Warehouse ${warehouse.id} - Image ${i + 1}`}
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
                </Image.PreviewGroup>
              </div>
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

        {/* ── Actions ─────────────────────────────────────────── */}
        <div
          className={m ? 'warehouse-form-actions' : ''}
          style={{
            marginTop: 32,
            display: 'flex',
            flexDirection: m ? 'column' : 'row',
            justifyContent: 'flex-end',
            gap: 12,
            position: m ? 'sticky' : 'static',
            bottom: m ? 0 : 'auto',
            background: m ? 'var(--bg-secondary)' : 'transparent',
            padding: m ? '16px 0' : 0,
            borderTop: m ? '1px solid var(--border-primary)' : 'none',
          }}
        >
          <Button
            size="large"
            onClick={onClose}
            style={{ minWidth: 120, minHeight: m ? 44 : 'auto' }}
          >
            Close
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default WarehouseDetailsModal;
