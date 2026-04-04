import { useState, useEffect, useCallback } from 'react';
import { Upload, Button, Progress, Typography, Image, Card, Row, Col } from 'antd';
import {
  DeleteOutlined, EyeOutlined, PlusOutlined,
  PlayCircleOutlined, FileTextOutlined, LinkOutlined,
} from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useViewport } from '../hooks/useViewport';

const { Text } = Typography;

// ── File-type classification ─────────────────────────────────────────────────

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'];
const DOC_MIMES = [
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ACCEPT_STRING = [
  ...IMAGE_MIMES, ...VIDEO_MIMES, ...DOC_MIMES,
  // Extension fallbacks for Android / WebViews
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
].join(',');

/** Return 'images' | 'videos' | 'docs' based on MIME or extension */
const classifyFile = (file) => {
  const mime = file.type || '';
  if (IMAGE_MIMES.includes(mime) || mime.startsWith('image/')) return 'images';
  if (VIDEO_MIMES.includes(mime) || mime.startsWith('video/')) return 'videos';
  if (DOC_MIMES.includes(mime)) return 'docs';

  // Fallback: check extension
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'images';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'videos';
  if (DOC_EXTENSIONS.includes(ext)) return 'docs';

  return null; // rejected
};

/** Resolve MIME type from file — Android sometimes sends empty or octet-stream */
const resolveMime = (file) => {
  let contentType = file.type;
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = file.name.toLowerCase().split('.').pop();
    const map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    contentType = map[ext] || 'application/octet-stream';
  }
  return contentType;
};

const getFileName = (url) => {
  try { return new URL(url).pathname.split('/').pop() || url; }
  catch { return url.split('/').pop() || url; }
};

const EMPTY_MEDIA = { images: [], videos: [], docs: [] };

// ── Component ────────────────────────────────────────────────────────────────

/**
 * FileUpload — accepts images, videos, and documents.
 *
 * Props:
 *   value    : { images: string[], videos: string[], docs: string[] } | null
 *   onChange : (media: { images, videos, docs }) => void
 *   disabled : boolean
 *   maxSize  : number (MB, default 50)
 */
const FileUpload = ({ value, onChange, disabled = false, maxSize = 50 }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [media, setMedia] = useState(EMPTY_MEDIA);
  const { isMobile } = useViewport();
  const { handleUploadError, showSuccessMessage, showErrorMessage } = useErrorHandler();

  // Sync from prop
  useEffect(() => {
    if (value && typeof value === 'object') {
      setMedia({
        images: value.images || [],
        videos: value.videos || [],
        docs: value.docs || [],
      });
    } else {
      setMedia(EMPTY_MEDIA);
    }
  }, [value]);

  const notify = useCallback((next) => {
    setMedia(next);
    if (onChange) onChange(next);
  }, [onChange]);

  // Upload one file to R2 via presigned URL
  const uploadFile = async (file) => {
    const contentType = resolveMime(file);
    const { uploadUrl, imageUrl } = await warehouseService.getPresignedUrl(contentType);

    setUploadProgress(10);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 120000; // 2 min for large videos

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round(10 + (e.loaded / e.total) * 85));
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) { setUploadProgress(100); resolve(); }
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.send(file);
    });

    return imageUrl;
  };

  // Called by antd Upload for each selected file — uploads immediately
  const beforeUpload = (file) => {
    if (!file) return false;

    const category = classifyFile(file);
    if (!category) {
      showErrorMessage({ type: 'validation', message: 'Unsupported file type. Allowed: images, videos, PDFs, and Office documents.' });
      return false;
    }

    if (file.size / 1024 / 1024 >= maxSize) {
      showErrorMessage({ type: 'validation', message: `File must be smaller than ${maxSize}MB!` });
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    uploadFile(file)
      .then((url) => {
        setMedia(prev => {
          const next = { ...prev, [category]: [...prev[category], url] };
          if (onChange) onChange(next);
          return next;
        });
        showSuccessMessage('upload');
      })
      .catch((err) => {
        console.error('Upload failed:', err);
        handleUploadError(err, file.name);
      })
      .finally(() => {
        setUploading(false);
        setUploadProgress(0);
      });

    return false; // prevent antd default upload
  };

  const handleRemove = (category, urlToRemove) => {
    const next = { ...media, [category]: media[category].filter(u => u !== urlToRemove) };
    notify(next);
  };

  const totalCount = media.images.length + media.videos.length + media.docs.length;

  return (
    <div style={{ width: '100%' }}>
      {/* ── Images ── */}
      {media.images.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: 8 }}>
            Images ({media.images.length})
          </Text>
          <Row gutter={[8, 8]}>
            {media.images.map((url, i) => (
              <Col key={i} xs={12} sm={8} md={6}>
                <Card
                  size="small"
                  style={{ background: '#262626', border: '1px solid #303030' }}
                  styles={{ body: { padding: 8 } }}
                  actions={[
                    <EyeOutlined
                      key="view"
                      onClick={() => window.open(url, '_blank')}
                      style={{ color: '#1890ff', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                    />,
                    <DeleteOutlined
                      key="delete"
                      onClick={() => handleRemove('images', url)}
                      style={{ color: '#ff4d4f', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                      disabled={uploading}
                    />,
                  ]}
                >
                  <Image
                    src={url}
                    alt={`Image ${i + 1}`}
                    style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* ── Videos ── */}
      {media.videos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: 8 }}>
            Videos ({media.videos.length})
          </Text>
          <Row gutter={[8, 8]}>
            {media.videos.map((url, i) => (
              <Col key={i} xs={24} sm={12}>
                <Card
                  size="small"
                  style={{ background: '#262626', border: '1px solid #303030' }}
                  styles={{ body: { padding: 8 } }}
                  actions={[
                    <EyeOutlined
                      key="view"
                      onClick={() => window.open(url, '_blank')}
                      style={{ color: '#1890ff', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                    />,
                    <DeleteOutlined
                      key="delete"
                      onClick={() => handleRemove('videos', url)}
                      style={{ color: '#ff4d4f', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                      disabled={uploading}
                    />,
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <PlayCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                    <Text ellipsis style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, flex: 1 }}>
                      {getFileName(url)}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* ── Documents ── */}
      {media.docs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: 8 }}>
            Documents ({media.docs.length})
          </Text>
          <Row gutter={[8, 8]}>
            {media.docs.map((url, i) => (
              <Col key={i} xs={24} sm={12}>
                <Card
                  size="small"
                  style={{ background: '#262626', border: '1px solid #303030' }}
                  styles={{ body: { padding: 8 } }}
                  actions={[
                    <LinkOutlined
                      key="open"
                      onClick={() => window.open(url, '_blank')}
                      style={{ color: '#1890ff', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                    />,
                    <DeleteOutlined
                      key="delete"
                      onClick={() => handleRemove('docs', url)}
                      style={{ color: '#ff4d4f', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                      disabled={uploading}
                    />,
                  ]}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                    <FileTextOutlined style={{ fontSize: 20, color: '#faad14' }} />
                    <Text ellipsis style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, flex: 1 }}>
                      {getFileName(url)}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div style={{ marginBottom: 12, textAlign: 'center' }}>
          <Progress percent={uploadProgress} size="small" strokeColor="#1890ff" />
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Uploading...</Text>
        </div>
      )}

      {/* Upload button */}
      <Upload
        beforeUpload={beforeUpload}
        fileList={[]}
        accept={ACCEPT_STRING}
        disabled={disabled || uploading}
        showUploadList={false}
        multiple={false}
      >
        <Button
          icon={<PlusOutlined />}
          disabled={disabled || uploading}
          loading={uploading}
          style={{
            width: '100%',
            minHeight: isMobile ? 48 : 'auto',
            fontSize: isMobile ? 16 : 14,
            touchAction: 'manipulation',
          }}
          size={isMobile ? 'large' : 'middle'}
          type="dashed"
        >
          {uploading ? 'Uploading...' : totalCount === 0 ? 'Add File' : 'Add More Files'}
        </Button>
      </Upload>

      <div style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          Max {maxSize}MB per file. Supports images, videos, and documents (PDF, Word, Excel).
        </Text>
      </div>
    </div>
  );
};

export default FileUpload;
