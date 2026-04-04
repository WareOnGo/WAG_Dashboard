import React, { useState } from 'react';
import { Tag, Image, Space, Button } from 'antd';
import {
  EnvironmentOutlined,
  HomeOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  UndoOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  LinkOutlined
} from '@ant-design/icons';
import ResponsiveModal from './ResponsiveModal';
import RedactedPhone from './RedactedPhone';
import { useViewport } from '../hooks/useViewport';
import { downloadAllImages, ERROR_MESSAGES, isMobileBrowser } from '../utils/imageDownloadUtils';
import { showSuccessMessage, showErrorNotification } from '../utils/errorHandler';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import './ResponsiveModal.css';

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--bg-surface)',
    color: 'var(--text-muted)',
    fontSize: 13,
    flexShrink: 0,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  grid: {
    display: 'grid',
    background: 'var(--bg-card)',
    borderRadius: 10,
    border: '1px solid var(--border-primary)',
    padding: 8,
    gap: '2px 12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 16px',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
    lineHeight: 1.5,
  },
  heroBar: {
    display: 'flex',
    alignItems: 'stretch',
    background: 'var(--bg-card)',
    borderRadius: 10,
    border: '1px solid var(--border-primary)',
    marginBottom: 32,
    overflow: 'hidden',
    flexWrap: 'wrap',
  },
  heroStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '16px 20px',
    flex: '1 1 0',
    minWidth: 100,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    background: 'var(--border-primary)',
    flexShrink: 0,
  },
  mediaGrid: {
    display: 'grid',
    gap: 10,
  },
  emptyMedia: {
    fontSize: 13,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  videoCard: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--border-primary)',
    background: '#000',
  },
  docLink: {
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
  },
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const Field = ({ label, value }) => {
  if (value == null || value === '' || value === '-') return null;
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.fieldValue}>{value}</span>
    </div>
  );
};

const BoolField = ({ label, value }) => {
  if (value == null) return null;
  const yes = value === true || value === 'true' || value === 1;
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <Tag color={yes ? 'green' : 'red'} style={{ width: 'fit-content' }}>
        {yes ? 'Yes' : 'No'}
      </Tag>
    </div>
  );
};

const formatSpace = (space) => {
  if (!space) return null;
  if (Array.isArray(space)) {
    const total = space.reduce((s, v) => s + v, 0);
    return space.length > 1
      ? `${total.toLocaleString()} sq ft (${space.join(' + ')})`
      : `${total.toLocaleString()} sq ft`;
  }
  return `${Number(space).toLocaleString()} sq ft`;
};

const getFileNameFromUrl = (url) => {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split('/').pop();
    return name || url;
  } catch {
    return url.split('/').pop() || url;
  }
};

// ── Main Component ────────────────────────────────────────────────────────────

const WarehouseDetailsModal = ({
  visible = false,
  onClose,
  warehouse = null
}) => {
  const { isMobile } = useViewport();
  const [isDownloading, setIsDownloading] = useState(false);

  if (!warehouse) return null;

  const wd = warehouse.WarehouseData || warehouse.warehouseData || {};
  const media = getMediaFromWarehouse(warehouse);
  const imageUrls = media.images || [];
  const videoUrls = media.videos || [];
  const docUrls = media.docs || [];
  const hasMedia = imageUrls.length + videoUrls.length + docUrls.length > 0;

  const gridCols = isMobile ? '1fr 1fr' : '1fr 1fr 1fr';

  // ── Download handler ────────────────────────────────────────────────────

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
        duration: 6
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

  // ── Image preview toolbar ───────────────────────────────────────────────

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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      title={`Warehouse #${warehouse.id}`}
      maxWidth="900px"
      className="warehouse-details-modal"
    >
      {/* ── Hero bar: key metrics at a glance ── */}
      <div style={styles.heroBar}>
        <div style={styles.heroStat}>
          <span style={styles.fieldLabel}>Type</span>
          <span style={{ ...styles.fieldValue, fontSize: 15, fontWeight: 600 }}>
            {warehouse.warehouseType}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.heroStat}>
          <span style={styles.fieldLabel}>Total Space</span>
          <span style={{ ...styles.fieldValue, fontSize: 15, fontWeight: 600 }}>
            {formatSpace(warehouse.totalSpaceSqft) || '-'}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.heroStat}>
          <span style={styles.fieldLabel}>Rate</span>
          <span style={{ ...styles.fieldValue, fontSize: 15, fontWeight: 600 }}>
            {warehouse.ratePerSqft ? `₹${warehouse.ratePerSqft}/sqft` : '-'}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.heroStat}>
          <span style={styles.fieldLabel}>Status</span>
          <Tag
            color={
              warehouse.availability?.toLowerCase().includes('available') ? 'green' :
              warehouse.availability?.toLowerCase().includes('occupied') ? 'red' :
              warehouse.availability?.toLowerCase().includes('partial') ? 'orange' : 'default'
            }
            style={{ width: 'fit-content', margin: 0 }}
          >
            {warehouse.availability || 'Unknown'}
          </Tag>
        </div>
      </div>

      {/* ── Location & Contact ── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionIcon}><EnvironmentOutlined /></div>
          <h4 style={styles.sectionTitle}>Location & Contact</h4>
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: gridCols }}>
          <Field label="Address" value={warehouse.address} />
          <Field label="City" value={warehouse.city} />
          <Field label="State" value={warehouse.state} />
          <Field label="Postal Code" value={warehouse.postalCode} />
          <Field label="Zone" value={warehouse.zone} />
          {warehouse.googleLocation && (
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Google Maps</span>
              <a
                href={warehouse.googleLocation}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.fieldValue, color: '#4ea1f5', textDecoration: 'none' }}
              >
                Open in Maps &rarr;
              </a>
            </div>
          )}
          <Field label="Contact Person" value={warehouse.contactPerson} />
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Contact Number</span>
            <span style={styles.fieldValue}>
              <RedactedPhone warehouseId={warehouse.id} />
            </span>
          </div>
        </div>
      </div>

      {/* ── Warehouse Specs ── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionIcon}><HomeOutlined /></div>
          <h4 style={styles.sectionTitle}>Warehouse Specs</h4>
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: gridCols }}>
          <Field label="Owner Type" value={warehouse.warehouseOwnerType} />
          <Field label="Offered Space" value={warehouse.offeredSpaceSqft ? `${warehouse.offeredSpaceSqft} sq ft` : null} />
          <Field label="No. of Docks" value={warehouse.numberOfDocks} />
          <Field label="Clear Height" value={warehouse.clearHeightFt ? `${warehouse.clearHeightFt} ft` : null} />
          <Field label="Dimensions" value={wd.dimensions} />
          <Field label="Parking / Docking" value={wd.parkingDockingSpace} />
          <Field label="Compliances" value={warehouse.compliances} />
          <Field label="Other Specs" value={warehouse.otherSpecifications} />
          <BoolField label="Is Broker" value={warehouse.isBroker} />
          <BoolField label="Visibility" value={warehouse.visibility} />
        </div>
      </div>

      {/* ── Infrastructure ── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div style={styles.sectionIcon}><ThunderboltOutlined /></div>
          <h4 style={styles.sectionTitle}>Infrastructure</h4>
        </div>
        <div style={{ ...styles.grid, gridTemplateColumns: gridCols }}>
          <BoolField label="Fire NOC" value={wd.fireNocAvailable} />
          <Field label="Fire Safety" value={wd.fireSafetyMeasures} />
          <Field label="Land Type" value={wd.landType} />
          <Field label="Approach Road" value={wd.approachRoadWidth ? `${wd.approachRoadWidth} ft` : null} />
          <Field label="Power" value={wd.powerKva ? `${wd.powerKva} KVA` : null} />
          <Field label="Pollution Zone" value={wd.pollutionZone} />
          <BoolField label="Vaastu" value={wd.vaastuCompliance} />
          <Field label="Latitude" value={wd.latitude} />
          <Field label="Longitude" value={wd.longitude} />
        </div>
      </div>

      {/* ── Media ── */}
      {hasMedia && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionIcon}><FileTextOutlined /></div>
            <h4 style={styles.sectionTitle}>
              Media
              <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                {imageUrls.length + videoUrls.length + docUrls.length} file{imageUrls.length + videoUrls.length + docUrls.length > 1 ? 's' : ''}
              </span>
            </h4>
          </div>

          {/* Images */}
          {imageUrls.length > 0 && (
            <div style={{ marginBottom: videoUrls.length || docUrls.length ? 24 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Images ({imageUrls.length})
                </span>
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
              <div style={{ ...styles.mediaGrid, gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
                <Image.PreviewGroup>
                  {imageUrls.map((url, i) => (
                    <Image
                      key={i}
                      src={url}
                      alt={`Warehouse ${warehouse.id} - Image ${i + 1}`}
                      style={{
                        width: '100%',
                        height: isMobile ? 130 : 120,
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
            </div>
          )}

          {/* Videos */}
          {videoUrls.length > 0 && (
            <div style={{ marginBottom: docUrls.length ? 24 : 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
                Videos ({videoUrls.length})
              </span>
              <div style={{ ...styles.mediaGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
                {videoUrls.map((url, i) => (
                  <div key={i} style={styles.videoCard}>
                    <video
                      src={url}
                      controls
                      preload="metadata"
                      style={{ width: '100%', height: isMobile ? 180 : 200, objectFit: 'contain', background: '#000' }}
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)' }}>
                      <PlayCircleOutlined />
                      {getFileNameFromUrl(url)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {docUrls.length > 0 && (
            <div>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
                Documents ({docUrls.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.docLink}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  >
                    <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'var(--bg-surface)', flexShrink: 0 }}>
                      <FileTextOutlined style={{ fontSize: 14, color: 'var(--text-muted)' }} />
                    </div>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getFileNameFromUrl(url)}
                    </span>
                    <LinkOutlined style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No media at all */}
      {!hasMedia && (
        <div style={{ ...styles.section, textAlign: 'center', padding: '20px 0' }}>
          <span style={styles.emptyMedia}>No media files attached</span>
        </div>
      )}

      {/* ── Footer meta ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        marginTop: 8,
        borderTop: '1px solid var(--border-primary)',
        fontSize: 12,
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span>Uploaded by: {warehouse.uploadedBy}</span>
        {warehouse.createdAt && (
          <span>{new Date(warehouse.createdAt).toLocaleDateString()}</span>
        )}
      </div>
    </ResponsiveModal>
  );
};

export default WarehouseDetailsModal;
