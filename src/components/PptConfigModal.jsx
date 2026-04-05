import React, { useState, useEffect } from 'react';
import { Modal, Radio, Input, Button, Space, Spin, Typography, Image, message } from 'antd';
import {
  FileTextOutlined,
  EnvironmentOutlined,
  BarChartOutlined,
  LoadingOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useViewport } from '../hooks';

const { Text, Title } = Typography;

const PPT_TYPES = [
  {
    value: 'standard',
    icon: <FileTextOutlined />,
    title: 'Standard PPT',
    desc: 'Basic warehouse info with selected images',
  },
  {
    value: 'standard-with-location',
    icon: <EnvironmentOutlined />,
    title: 'Standard + Location',
    desc: 'Includes Google Maps link instead of security deposit',
  },
  {
    value: 'detailed',
    icon: <BarChartOutlined />,
    title: 'Detailed PPT',
    desc: 'Geospatial data, satellite images, distance highlights (takes longer)',
  },
];

/**
 * Multi-step modal for PPT configuration:
 *   Step 1 — Select PPT type
 *   Step 2 — Preview warehouses, select images, fill custom details
 *   Generating — Spinner overlay
 *
 * Props:
 *  - open: boolean
 *  - warehouseIds: string (comma-separated)
 *  - onCancel: () => void
 *  - onGenerate: ({ pptType, customDetails, selectedImages }) => Promise<void>
 *  - generating: boolean
 */
const PptConfigModal = ({ open, warehouseIds, allWarehouses, onCancel, onGenerate, generating }) => {
  const { isMobile } = useViewport();

  // Step management
  const [step, setStep] = useState(1);

  // Step 1 state
  const [pptType, setPptType] = useState('standard');

  // Step 2 state
  const [warehouses, setWarehouses] = useState([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [selectedImages, setSelectedImages] = useState({}); // { warehouseId: [url, ...] }
  const [clientName, setClientName] = useState('');
  const [clientRequirement, setClientRequirement] = useState('');
  const [pocName, setPocName] = useState('');
  const [pocContact, setPocContact] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setPptType('standard');
      setWarehouses([]);
      setSelectedImages({});
      setClientName('');
      setClientRequirement('');
      setPocName('');
      setPocContact('');
    }
  }, [open]);

  // Filter warehouses from pre-loaded data when moving to step 2
  const handleGoToStep2 = () => {
    const idList = warehouseIds.split(',').map((s) => s.trim()).filter(Boolean);
    const matched = (allWarehouses || []).filter((wh) => idList.includes(String(wh.id)));

    if (matched.length === 0) {
      message.error('No matching warehouses found for the entered IDs');
      return;
    }
    setWarehouses(matched);

    // Auto-select first 4 images per warehouse for detailed
    const autoSelected = {};
    matched.forEach((wh) => {
      if (wh.photos) {
        const allUrls = wh.photos.split(',').map((u) => u.trim());
        const imageUrls = allUrls.filter((u) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u));
        if (pptType === 'detailed') {
          autoSelected[wh.id] = imageUrls.slice(0, 4);
        } else {
          autoSelected[wh.id] = [];
        }
      }
    });
    setSelectedImages(autoSelected);
    setStep(2);
  };

  // Toggle image selection
  const toggleImage = (warehouseId, url) => {
    setSelectedImages((prev) => {
      const current = prev[warehouseId] || [];
      const isSelected = current.includes(url);
      const isStandard = pptType === 'standard' || pptType === 'standard-with-location';

      if (isSelected) {
        return { ...prev, [warehouseId]: current.filter((u) => u !== url) };
      }

      // Standard: max 4 images per warehouse
      if (isStandard && current.length >= 4) {
        message.warning('Maximum 4 images per warehouse for standard PPT');
        return prev;
      }

      return { ...prev, [warehouseId]: [...current, url] };
    });
  };

  const handleSubmit = () => {
    const isDetailed = pptType === 'detailed';
    const customDetails = isDetailed
      ? {
          companyName: clientName.trim(),
          clientRequirement: clientRequirement.trim(),
          employeeName: pocName.trim(),
        }
      : {
          clientName: clientName.trim(),
          clientRequirement: clientRequirement.trim(),
          pocName: pocName.trim(),
          pocContact: pocContact.trim() ? `+91${pocContact.trim()}` : '',
        };

    onGenerate({ pptType, customDetails, selectedImages });
  };

  // --- Render helpers ---

  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Text style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>
        Select the type of presentation to generate for warehouse IDs: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{warehouseIds}</strong>
      </Text>

      <Radio.Group
        value={pptType}
        onChange={(e) => setPptType(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        {PPT_TYPES.map((t) => (
          <label
            key={t.value}
            onClick={() => setPptType(t.value)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '8px',
              border: pptType === t.value
                ? '1px solid rgba(24, 144, 255, 0.5)'
                : '1px solid rgba(255,255,255,0.1)',
              background: pptType === t.value
                ? 'rgba(24, 144, 255, 0.06)'
                : 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Radio value={t.value} style={{ marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{
                fontWeight: 600,
                fontSize: '14px',
                color: pptType === t.value ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                {t.icon} {t.title}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.5' }}>
                {t.desc}
              </span>
            </div>
          </label>
        ))}
      </Radio.Group>
    </div>
  );

  const renderImageGallery = (warehouse) => {
    if (!warehouse.photos) {
      return (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          No photos available
        </Text>
      );
    }

    const allUrls = warehouse.photos.split(',').map((u) => u.trim());
    const imageUrls = allUrls.filter((u) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u));

    if (imageUrls.length === 0) {
      return (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          No image files available
        </Text>
      );
    }

    const selected = selectedImages[warehouse.id] || [];
    const isStandard = pptType === 'standard' || pptType === 'standard-with-location';

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {imageUrls.map((url) => {
          const isActive = selected.includes(url);
          return (
            <div
              key={url}
              onClick={() => toggleImage(warehouse.id, url)}
              style={{
                position: 'relative',
                width: '90px',
                height: '90px',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: isActive ? '2px solid #1890ff' : '2px solid transparent',
                opacity: isActive ? 1 : 0.7,
                transition: 'all 0.15s ease',
              }}
            >
              <img
                src={url}
                alt="Warehouse"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                loading="lazy"
              />
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: '#1890ff',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CheckCircleFilled style={{ color: '#fff', fontSize: '12px' }} />
                </div>
              )}
            </div>
          );
        })}
        {isStandard && (
          <div style={{ width: '100%', marginTop: '4px' }}>
            <Text style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              Select up to 4 images • {selected.length}/4 selected
            </Text>
          </div>
        )}
        {pptType === 'detailed' && (
          <div style={{ width: '100%', marginTop: '4px' }}>
            <Text style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
              {selected.length} image{selected.length !== 1 ? 's' : ''} selected
            </Text>
          </div>
        )}
      </div>
    );
  };

  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Warehouse previews with image selection */}
      <div>
        <Text strong style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: '12px' }}>
          Select Images
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)' }}>
                  #{wh.id} — {wh.city}, {wh.state}
                </Text>
                <Text style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                  {wh.address} • {wh.warehouseType} • ₹{wh.ratePerSqft}/sq ft
                </Text>
              </div>
              {renderImageGallery(wh)}
            </div>
          ))}
        </div>
      </div>

      {/* Custom details form */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <Text strong style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)' }}>
          Presentation Details
        </Text>

        <div>
          <label style={labelStyle}>Client / Company Name</label>
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g., XYZ Corp"
          />
        </div>

        <div>
          <label style={labelStyle}>Client Requirement</label>
          <Input
            value={clientRequirement}
            onChange={(e) => setClientRequirement(e.target.value)}
            placeholder="e.g., Nelamangala, Bangalore - 100,000 sft"
          />
        </div>

        <div>
          <label style={labelStyle}>
            {pptType === 'detailed' ? 'Employee Name' : 'WareOnGo POC Name'}
          </label>
          <Input
            value={pocName}
            onChange={(e) => setPocName(e.target.value)}
            placeholder="e.g., Dhaval Gupta"
          />
        </div>

        {pptType !== 'detailed' && (
          <div>
            <label style={labelStyle}>WareOnGo POC Contact</label>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                style={{
                  width: '56px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  pointerEvents: 'none',
                  flexShrink: 0,
                }}
                value="+91"
                readOnly
              />
              <Input
                value={pocContact}
                onChange={(e) => setPocContact(e.target.value)}
                placeholder="83188 25478"
                style={{ flex: 1 }}
              />
            </Space.Compact>
          </div>
        )}
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '56px 0',
      gap: '20px',
    }}>
      <Spin indicator={<LoadingOutlined style={{ fontSize: 44 }} spin />} />
      <div style={{ textAlign: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', display: 'block', marginBottom: '6px' }}>
          Generating presentation…
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
          {pptType === 'detailed'
            ? 'This may take 10–60 seconds per warehouse (geospatial enrichment).'
            : 'This should take a few seconds.'}
        </Text>
      </div>
    </div>
  );

  // --- Footer buttons ---

  const getFooter = () => {
    if (generating) return null;

    if (step === 1) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" onClick={handleGoToStep2} loading={loadingWarehouses}>
            Next
          </Button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setStep(1)}>← Back</Button>
        <Button type="primary" onClick={handleSubmit}>
          Generate PPT
        </Button>
      </div>
    );
  };

  return (
    <Modal
      title={
        <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Verdana, sans-serif' }}>
          {step === 1 ? 'Select Presentation Type' : 'Configure Presentation'}
        </span>
      }
      open={open}
      onCancel={() => { if (!generating) onCancel(); }}
      width={isMobile ? '95vw' : 600}
      centered
      maskClosable={!generating}
      closable={!generating}
      footer={getFooter()}
      styles={{
        body: { maxHeight: '70vh', overflowY: 'auto', fontFamily: 'Verdana, sans-serif' },
      }}
    >
      {generating ? renderGenerating() : step === 1 ? renderStep1() : renderStep2()}
    </Modal>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '13px',
  fontWeight: 500,
  color: 'rgba(255,255,255,0.6)',
  fontFamily: 'Verdana, sans-serif',
};

export default PptConfigModal;
