import { useState, useEffect } from 'react';
import { Upload, Button, Progress, Typography, Image, Card, Row, Col } from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useViewport } from '../hooks/useViewport';

const { Text } = Typography;

const FileUpload = ({ value, onChange, disabled = false, maxSize = 5 }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  const { isMobile } = useViewport();
  const { handleUploadError, showSuccessMessage, showErrorMessage } = useErrorHandler();

  // Sync imageUrls from form value
  useEffect(() => {
    if (value && typeof value === 'string') {
      setImageUrls(value.split(',').map(u => u.trim()).filter(Boolean));
    } else {
      setImageUrls([]);
    }
  }, [value]);

  // Notify the parent Form.Item whenever URLs change
  const updateFormValue = (urls) => {
    setImageUrls(urls);
    if (onChange) {
      onChange(urls.length > 0 ? urls.join(', ') : '');
    }
  };

  // Upload one file to R2 via presigned URL
  const uploadFile = async (file) => {
    // Resolve MIME type — Android sometimes sends empty or application/octet-stream
    let contentType = file.type;
    if (!contentType || contentType === 'application/octet-stream') {
      const ext = file.name.toLowerCase().split('.').pop();
      const mimeMap = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
      };
      contentType = mimeMap[ext] || 'image/jpeg';
    }

    const { uploadUrl, imageUrl } = await warehouseService.getPresignedUrl(contentType);

    setUploadProgress(10);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 30000;

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
    // Validate
    if (!file) return false;

    const isImage = file.type.startsWith('image/') ||
      file.type === '' ||
      file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/);
    if (!isImage) {
      showErrorMessage({ type: 'validation', message: 'You can only upload image files!' });
      return false;
    }
    if (file.size / 1024 / 1024 >= maxSize) {
      showErrorMessage({ type: 'validation', message: `Image must be smaller than ${maxSize}MB!` });
      return false;
    }

    // Upload immediately
    setUploading(true);
    setUploadProgress(0);

    uploadFile(file)
      .then((url) => {
        // Use functional update to always read latest state
        setImageUrls(prev => {
          const next = [...prev, url];
          if (onChange) onChange(next.join(', '));
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

  const handleRemove = (urlToRemove) => {
    updateFormValue(imageUrls.filter(u => u !== urlToRemove));
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Uploaded images */}
      {imageUrls.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: 8 }}>
            Uploaded Images ({imageUrls.length})
          </Text>
          <Row gutter={[8, 8]}>
            {imageUrls.map((url, i) => (
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
                      onClick={() => handleRemove(url)}
                      style={{ color: '#ff4d4f', fontSize: isMobile ? 18 : 14, padding: isMobile ? 8 : 4 }}
                      disabled={uploading}
                    />,
                  ]}
                >
                  <Image
                    src={url}
                    alt={`Warehouse image ${i + 1}`}
                    style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                  />
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
        accept="image/*,image/heic,image/heif"
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
          {uploading ? 'Uploading...' : imageUrls.length === 0 ? 'Select Image' : 'Add More Images'}
        </Button>
      </Upload>

      <div style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          Max {maxSize}MB per image. Images upload immediately when selected.
        </Text>
      </div>
    </div>
  );
};

export default FileUpload;
