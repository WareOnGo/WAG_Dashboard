import React, { useState, useEffect } from 'react';
import { Upload, Button, Progress, Typography, Space, Image, Card, Row, Col } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import { useErrorHandler } from '../hooks/useErrorHandler';

const { Text } = Typography;

const FileUpload = ({ 
  value, 
  onChange, 
  disabled = false,
  maxSize = 5, // Max size in MB
  accept = 'image/*'
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  
  const { handleUploadError, showSuccessMessage, showErrorMessage } = useErrorHandler();

  // Parse existing value into array of URLs
  useEffect(() => {
    if (value && typeof value === 'string') {
      const urls = value.split(',').map(url => url.trim()).filter(url => url);
      setImageUrls(urls);
    } else {
      setImageUrls([]);
    }
  }, [value]);

  // File validation
  const validateFile = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      showErrorMessage({
        type: 'validation',
        message: 'You can only upload image files!'
      });
      return false;
    }

    const isLtMaxSize = file.size / 1024 / 1024 < maxSize;
    if (!isLtMaxSize) {
      showErrorMessage({
        type: 'validation',
        message: `Image must be smaller than ${maxSize}MB!`
      });
      return false;
    }

    return true;
  };

  // Two-step upload flow
  const handleUpload = async (file) => {
    if (!validateFile(file)) {
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned URL
      setUploadProgress(10);
      const { uploadUrl, imageUrl } = await warehouseService.getPresignedUrl(file.type);
      
      // Step 2: Upload directly to R2
      setUploadProgress(30);
      
      // Create XMLHttpRequest for progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round(30 + (event.loaded / event.total) * 60); // 30-90%
            setUploadProgress(progress);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });
        
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Step 3: Add new image URL to the list
      const newUrls = [...imageUrls, imageUrl];
      setImageUrls(newUrls);
      
      if (onChange) {
        onChange(newUrls.join(', '));
      }
      
      showSuccessMessage('upload');
      
    } catch (error) {
      console.error('Upload error:', error);
      handleUploadError(error, file.name);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // Handle file selection (before upload)
  const beforeUpload = (file) => {
    // Trigger upload immediately after selection
    handleUpload(file);
    return false; // Prevent default upload
  };

  // Remove specific image
  const handleRemove = (urlToRemove) => {
    const newUrls = imageUrls.filter(url => url !== urlToRemove);
    setImageUrls(newUrls);
    
    if (onChange) {
      onChange(newUrls.length > 0 ? newUrls.join(', ') : '');
    }
  };

  // Custom upload props
  const uploadProps = {
    beforeUpload,
    fileList: [],
    accept,
    disabled: disabled || uploading,
    showUploadList: false,
    multiple: false, // Handle one at a time for better UX
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Image Preview Grid */}
      {imageUrls.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Row gutter={[8, 8]}>
            {imageUrls.map((url, index) => (
              <Col key={index} xs={12} sm={8} md={6}>
                <Card
                  size="small"
                  style={{ 
                    background: '#262626',
                    border: '1px solid #303030'
                  }}
                  styles={{ body: { padding: '8px' } }}
                  actions={[
                    <EyeOutlined 
                      key="view" 
                      onClick={() => window.open(url, '_blank')}
                      style={{ color: '#1890ff' }}
                    />,
                    <DeleteOutlined 
                      key="delete" 
                      onClick={() => handleRemove(url)}
                      style={{ color: '#ff4d4f' }}
                    />
                  ]}
                >
                  <Image
                    src={url}
                    alt={`Warehouse image ${index + 1}`}
                    style={{ 
                      width: '100%', 
                      height: '80px', 
                      objectFit: 'cover',
                      borderRadius: '4px'
                    }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Upload Button */}
      <Upload {...uploadProps}>
        <Button 
          icon={<PlusOutlined />} 
          disabled={disabled || uploading}
          style={{ width: '100%' }}
          type="dashed"
        >
          {imageUrls.length === 0 ? 'Upload Images' : 'Add More Images'}
        </Button>
      </Upload>
      
      {/* Upload Progress */}
      {uploading && (
        <div style={{ marginTop: '12px' }}>
          <Progress 
            percent={uploadProgress} 
            size="small" 
            status={uploadProgress === 100 ? 'success' : 'active'}
          />
          <Text type="secondary" style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
            Uploading image...
          </Text>
        </div>
      )}

      {/* Help Text */}
      <div style={{ marginTop: '8px' }}>
        <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)' }}>
          Upload multiple images (max {maxSize}MB each). Supported formats: JPG, PNG, GIF
        </Text>
      </div>
    </div>
  );
};

export default FileUpload;