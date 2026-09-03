import React, { useState, useEffect } from 'react';
import { Modal, Radio, Input, Button, Spin, Typography, Image, Checkbox, message } from 'antd';
import { verifiedNumberService } from '../services/verifiedNumberService';
import PocSelect from './PocSelect';
import {
  BarChartOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  AppstoreOutlined,
  ShopOutlined,
  TruckOutlined,
  ExperimentOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useViewport } from '../hooks';
import { useAuth } from '../contexts';
import { describeLatLngInput } from '../utils/latLngInput';
import { groupImagesByClassification } from '../utils/mediaUtils';

const { Text, Title } = Typography;

const PPT_TYPES = [
  {
    value: 'v2',
    icon: <AppstoreOutlined />,
    title: 'PPT v2 (Standard)',
    desc: 'New layout: sidebar tables, photo grid, fixed cover hero',
  },
  {
    value: 'detailed',
    icon: <BarChartOutlined />,
    title: 'Detailed PPT',
    desc: 'Geospatial data, satellite images, distance highlights (takes longer)',
  },
  {
    value: 'godamwale',
    icon: <ShopOutlined />,
    title: 'Godamwale (External)',
    desc: 'Godamwale-branded deck for external sharing',
  },
  {
    value: 'tci',
    icon: <TruckOutlined />,
    title: 'TCI (External)',
    desc: 'TCI-branded 4:3 deck for external sharing',
  },
  // Kept last: still being trialled, so it should not be the first thing the eye
  // lands on when picking a deck for a client.
  {
    value: 'v3',
    icon: <ExperimentOutlined />,
    title: 'PPT V3 (beta)',
    desc: 'WareOnGo branding with the full specification table and a dedicated photos slide',
  },
];

/**
 * Decks that cap photo selection at four per warehouse — the layouts have four
 * photo slots and silently drop the rest.
 */
/**
 * Decks that take at most four photographs per property.
 *
 * v3 is deliberately absent: it paginates photographs across as many slides as it
 * needs, so a cap would only throw away images the deck can show. The others each
 * have a single fixed photo grid with four cells.
 */
const CAPPED_PHOTO_TYPES = ['v2', 'godamwale', 'tci'];
/** Decks that render layout drawings on their own slides. */
const CAD_CAPABLE_TYPES = ['v3'];

/** Decks that accept the deck-content redaction flags. */
const REDACTABLE_TYPES = ['v2', 'v3'];

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
  const { user } = useAuth();

  // Step management
  const [step, setStep] = useState(1);

  // Step 1 state
  const [pptType, setPptType] = useState('v2');

  // Step 2 state
  const [warehouses, setWarehouses] = useState([]);
  const [selectedImages, setSelectedImages] = useState({}); // { warehouseId: [url, ...] }
  // Layout drawings, kept separate from photographs because they land on their own
  // slides. An image is one or the other, never both — it appears once in the deck.
  const [selectedCad, setSelectedCad] = useState({}); // { warehouseId: [url, ...] }
  const [clientName, setClientName] = useState('');
  const [clientRequirement, setClientRequirement] = useState('');
  const [pocName, setPocName] = useState('');
  const [pocContact, setPocContact] = useState('');

  // Free text, parsed on every keystroke rather than stored as coordinates: the
  // raw string is what the user can see and correct, so it is what state holds.
  const [clientLocation, setClientLocation] = useState('');

  // WareOnGo POCs fetched from the verified-numbers table (single API call),
  // used to populate the POC dropdown. `selectedPocId` tracks the chosen row.
  const [pocs, setPocs] = useState([]);
  const [pocsLoading, setPocsLoading] = useState(false);
  const [selectedPocId, setSelectedPocId] = useState(undefined);

  // v2 redaction flags — default enabled (full, unredacted deck)
  const [commercials, setCommercials] = useState(true);
  const [mapsLocation, setMapsLocation] = useState(true);
  const [pocSlide, setPocSlide] = useState(true);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep(1);
      setPptType('v2');
      setWarehouses([]);
      setSelectedImages({});
      setSelectedCad({});
      setClientName('');
      setClientRequirement('');
      setPocName('');
      setPocContact('');
      setClientLocation('');
      setSelectedPocId(undefined);
      setCommercials(true);
      setMapsLocation(true);
      setPocSlide(true);
    }
  }, [open]);

  // Normalise a stored phone number to its last 10 digits (Indian mobiles);
  // the +91 prefix is applied on submit / shown separately in the dropdown.
  const toLocalDigits = (raw) => (raw || '').replace(/\D/g, '').slice(-10);

  // Fetch the POC list once per open (single API call). Kept in state so both
  // the detailed and standard flows share the same dropdown data.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPocsLoading(true);
    verifiedNumberService.list()
      .then((rows) => {
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        setPocs(list);
        // Default the POC to the logged-in user's own entry (matched by email).
        const email = user?.email?.toLowerCase();
        const me = email ? list.find((p) => p.email?.toLowerCase() === email) : null;
        if (me) {
          setSelectedPocId(me.id);
          setPocName(me.name || '');
          setPocContact(toLocalDigits(me.phone_number));
        }
      })
      .catch(() => {
        if (active) {
          setPocs([]);
          message.error('Failed to load POC list');
        }
      })
      .finally(() => { if (active) setPocsLoading(false); });
    return () => { active = false; };
  }, [open, user?.email]);

  // Choosing a POC fills both the name and the contact number.
  const handleSelectPoc = (id) => {
    setSelectedPocId(id);
    const poc = pocs.find((p) => p.id === id);
    setPocName(poc?.name || '');
    setPocContact(poc ? toLocalDigits(poc.phone_number) : '');
  };

  // Filter warehouses from pre-loaded data when moving to step 2
  const handleGoToStep2 = () => {
    const idList = warehouseIds.split(',').map((s) => s.trim()).filter(Boolean);
    const whMap = new Map((allWarehouses || []).map((wh) => [String(wh.id), wh]));
    const matched = idList.map((id) => whMap.get(id)).filter(Boolean);

    if (matched.length === 0) {
      message.error('No matching warehouses found for the entered IDs');
      return;
    }
    setWarehouses(matched);

    // Auto-select first 4 images per warehouse for detailed
    const autoSelected = {};
    // Layout drawings the classifier already identified, pre-ticked. Only images
    // sub-labelled LAYOUT — a DOCUMENT with no sub-label yet, or one labelled
    // PAPERWORK or OTHER_DOCUMENT, is left for a human. Pre-ticking a khata
    // extract would be far worse than pre-ticking nothing.
    const autoCad = {};
    matched.forEach((wh) => {
      if (wh.photos) {
        const allUrls = wh.photos.split(',').map((u) => u.trim());
        const imageUrls = allUrls.filter((u) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u));
        if (pptType === 'detailed') {
          autoSelected[wh.id] = imageUrls.slice(0, 4);
        } else {
          autoSelected[wh.id] = [];
        }
        const layouts = imageUrls.filter(
          (u) => wh.imageLabels?.[u]?.documentKind === 'LAYOUT',
        );
        if (layouts.length) autoCad[wh.id] = layouts;
      }
    });
    setSelectedImages(autoSelected);
    setSelectedCad(autoCad);
    setStep(2);
  };

  // Toggle image selection
  /** Marking an image as a layout takes it out of the photographs, and vice versa. */
  const toggleCad = (warehouseId, url) => {
    setSelectedCad((prev) => {
      const current = prev[warehouseId] || [];
      if (current.includes(url)) {
        return { ...prev, [warehouseId]: current.filter((u) => u !== url) };
      }
      setSelectedImages((prevPhotos) => ({
        ...prevPhotos,
        [warehouseId]: (prevPhotos[warehouseId] || []).filter((u) => u !== url),
      }));
      setSelectedCad((prevCad) => ({
        ...prevCad,
        [warehouseId]: (prevCad[warehouseId] || []).filter((u) => u !== url),
      }));
      return { ...prev, [warehouseId]: [...current, url] };
    });
  };

  const toggleImage = (warehouseId, url) => {
    setSelectedImages((prev) => {
      const current = prev[warehouseId] || [];
      const isSelected = current.includes(url);
      const isStandard = CAPPED_PHOTO_TYPES.includes(pptType);

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
    const clientSite = describeLatLngInput(clientLocation);
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
          // Only v3 renders the comparison slide, and only when a point is given
          // — an unparseable or empty field sends nothing, which the backend
          // reads as "omit that slide" rather than as an error.
          ...(pptType === 'v3' && clientSite.coords && { clientLocation: clientSite.coords }),
          // Deck-level redaction flags, sent only to the decks that honour them;
          // unchecked → false redacts the corresponding content.
          ...(REDACTABLE_TYPES.includes(pptType) && { commercials, mapsLocation, pocSlide }),
        };

    // v3 renders layout drawings on their own slides, so its selection carries the
    // two kinds separately. Every other deck takes the flat array it always has —
    // the backend accepts both shapes, so nothing else had to change.
    const payloadImages = CAD_CAPABLE_TYPES.includes(pptType)
      ? Object.fromEntries(
        warehouses.map((wh) => [wh.id, {
          photos: selectedImages[wh.id] || [],
          cad: selectedCad[wh.id] || [],
        }]).filter(([, v]) => v.photos.length || v.cad.length),
      )
      : selectedImages;

    onGenerate({ pptType, customDetails, selectedImages: payloadImages });
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

  /**
   * One image tile. `mode` decides what a click means in the section it sits in.
   */
  const renderTile = (warehouse, url, mode, kind) => {
    const isCad = mode === 'cad';
    const active = isCad
      ? (selectedCad[warehouse.id] || []).includes(url)
      : (selectedImages[warehouse.id] || []).includes(url);
    const accent = isCad ? '#fa8c16' : '#1890ff';

    return (
      <div
        key={url}
        onClick={() => (isCad ? toggleCad(warehouse.id, url) : toggleImage(warehouse.id, url))}
        style={{
          position: 'relative',
          width: '90px',
          height: '90px',
          borderRadius: '6px',
          overflow: 'hidden',
          cursor: 'pointer',
          border: active ? `2px solid ${accent}` : '2px solid transparent',
          opacity: active ? 1 : 0.7,
          transition: 'all 0.15s ease',
        }}
      >
        <img
          src={url}
          alt="Warehouse"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
          crossOrigin="anonymous"
        />
        {kind && (
          // What the classifier called it, so a pre-ticked drawing is explained and
          // a mislabelled one is visibly arguable rather than silently trusted.
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(0,0,0,0.6)',
            color: kind === 'LAYOUT' ? '#ffd591' : 'rgba(255,255,255,0.6)',
            fontSize: '9px',
            padding: '1px 3px',
            textAlign: 'center',
          }}>
            {kind === 'LAYOUT' ? 'layout' : kind === 'PAPERWORK' ? 'paperwork' : 'other'}
          </div>
        )}
        {active && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: accent,
            borderRadius: isCad ? '4px' : '50%',
            minWidth: '20px',
            height: '20px',
            padding: isCad ? '0 5px' : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {isCad
              ? <span style={{ color: '#fff', fontSize: '10px', fontWeight: 600 }}>CAD</span>
              : <CheckCircleFilled style={{ color: '#fff', fontSize: '12px' }} />}
          </div>
        )}
      </div>
    );
  };

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
    const cad = selectedCad[warehouse.id] || [];
    const isStandard = CAPPED_PHOTO_TYPES.includes(pptType);
    const cadCapable = CAD_CAPABLE_TYPES.includes(pptType);

    // Grouped by what the classifier saw, so the documents — where the layout
    // drawings are — are together and can be asked about directly. Returns null
    // when a listing has no labels yet, in which case the flat grid is still right.
    const sections = groupImagesByClassification(imageUrls, warehouse.imageLabels);

    const counter = (
      <div style={{ width: '100%', marginTop: '4px' }}>
        <Text style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          {isStandard
            ? `Select up to 4 images • ${selected.length}/4 selected`
            : `${selected.length} photo${selected.length !== 1 ? 's' : ''} selected`}
          {cadCapable && cad.length > 0
            && ` • ${cad.length} layout${cad.length !== 1 ? 's' : ''}, one slide each`}
        </Text>
      </div>
    );

    if (!sections) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {imageUrls.map((url) => renderTile(warehouse, url, 'photo'))}
          {counter}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sections.map((section) => {
          // In the documents section of a v3 deck a click marks a layout drawing,
          // because that is the only thing anyone wants from a document there — a
          // khata extract does not belong in a client deck at all.
          const mode = cadCapable && section.key === 'DOCUMENT' ? 'cad' : 'photo';
          return (
            <div key={section.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <Text style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
                  {section.title}
                </Text>
                <Text style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  {section.urls.length}
                </Text>
              </div>
              {mode === 'cad' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <FileTextOutlined style={{ color: '#fa8c16', fontSize: '11px' }} />
                  <Text style={{ fontSize: '11px', color: '#fa8c16' }}>
                    Pick the CAD / layout drawings — each gets a full slide of its own.
                    Leave paperwork unselected.
                  </Text>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(mode === 'cad'
                  // Drawings first: they are what this section is being read for,
                  // and paperwork below them needs no attention at all.
                  ? [...section.urls].sort((a, b) => {
                    const rank = (u) => (warehouse.imageLabels?.[u]?.documentKind === 'LAYOUT' ? 0 : 1);
                    return rank(a) - rank(b);
                  })
                  : section.urls
                ).map((url) => renderTile(warehouse, url, mode,
                  mode === 'cad' ? warehouse.imageLabels?.[url]?.documentKind : null))}
              </div>
            </div>
          );
        })}
        {counter}
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

        {pptType === 'v3' && (() => {
          const site = describeLatLngInput(clientLocation);
          return (
            <div>
              <label style={labelStyle}>Client&apos;s own location (optional)</label>
              <Input
                value={clientLocation}
                onChange={(e) => setClientLocation(e.target.value)}
                placeholder="Paste coordinates or a Google Maps link"
                status={site.status === 'error' ? 'error' : undefined}
              />
              <Text style={{
                fontSize: '12px',
                display: 'block',
                marginTop: '6px',
                color: site.status === 'error' ? '#ff7875' : 'rgba(255,255,255,0.45)',
              }}>
                {site.message
                  || 'Adds a slide ranking every property by road distance from this point. Leave blank to omit it.'}
              </Text>
            </div>
          );
        })()}

        <div>
          <label style={labelStyle}>
            {pptType === 'detailed' ? 'Employee (POC)' : 'WareOnGo POC'}
          </label>
          <PocSelect
            pocs={pocs}
            loading={pocsLoading}
            value={selectedPocId}
            onChange={handleSelectPoc}
            detailed={pptType === 'detailed'}
          />
          {pptType !== 'detailed' && pocContact && (
            <Text style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', display: 'block', marginTop: '6px' }}>
              Contact: +91 {pocContact}
            </Text>
          )}
        </div>

        {REDACTABLE_TYPES.includes(pptType) && (
          <div>
            <label style={labelStyle}>Deck Content</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Checkbox checked={commercials} onChange={(e) => setCommercials(e.target.checked)}>
                <span style={checkboxLabelStyle}>
                  Include rent / commercials
                  <span style={checkboxHintStyle}>Unchecked shows “Available on Demand”</span>
                </span>
              </Checkbox>
              <Checkbox checked={mapsLocation} onChange={(e) => setMapsLocation(e.target.checked)}>
                <span style={checkboxLabelStyle}>
                  Include Google Maps location
                  <span style={checkboxHintStyle}>Unchecked shows “Available on Demand”</span>
                </span>
              </Checkbox>
              <Checkbox checked={pocSlide} onChange={(e) => setPocSlide(e.target.checked)}>
                <span style={checkboxLabelStyle}>
                  Include WareOnGo POC slide
                  <span style={checkboxHintStyle}>Unchecked drops the final contact slide</span>
                </span>
              </Checkbox>
            </div>
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
          <Button type="primary" onClick={handleGoToStep2}>
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

const checkboxLabelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  fontSize: '13px',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: 'Verdana, sans-serif',
};

const checkboxHintStyle = {
  fontSize: '11px',
  color: 'rgba(255,255,255,0.4)',
};

export default PptConfigModal;
