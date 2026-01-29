import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Upload, Button, Progress, Typography, Image, Card, Row, Col } from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useViewport } from '../hooks/useViewport';

const { Text } = Typography;

const FileUpload = forwardRef(({ 
  value, 
  onChange, 
  disabled = false,
  maxSize = 5, // Max size in MB
  accept = 'image/*'
}, ref) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // Files waiting to be uploaded
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const { isMobile } = useViewport();
  
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

  // Upload a single file with retry logic
  const uploadSingleFile = async (file, index, retries = 2) => {
    setCurrentUploadIndex(index);
    setUploadProgress(0);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Step 1: Get presigned URL
        setUploadProgress(10);
        const { uploadUrl, imageUrl } = await warehouseService.getPresignedUrl(file.type);
        
        // Step 2: Upload directly to R2
        setUploadProgress(30);
        
        // Create XMLHttpRequest for progress tracking
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Set timeout for upload (30 seconds)
          xhr.timeout = 30000;
          
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
            reject(new Error('Network error during upload'));
          });
          
          xhr.addEventListener('timeout', () => {
            reject(new Error('Upload timeout - please check your connection'));
          });
          
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });
        
        return { success: true, imageUrl };
        
      } catch (error) {
        console.error(`Upload attempt ${attempt + 1} failed:`, error);
        
        // If this was the last retry, throw the error
        if (attempt === retries) {
          handleUploadError(error, file.name);
          return { success: false, error: error.message };
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
    
    return { success: false, error: 'Upload failed after retries' };
  };

  // Upload all pending files (called when form is submitted)
  const uploadAllFiles = async () => {
    if (pendingFiles.length === 0) {
      return imageUrls; // Return existing URLs if no pending files
    }

    setUploading(true);
    const uploadedUrls = [...imageUrls];
    
    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const item = pendingFiles[i];
        const result = await uploadSingleFile(item.file, i);
        
        if (result.success && result.imageUrl) {
          uploadedUrls.push(result.imageUrl);
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      }
      
      // Update state with all uploaded URLs
      setImageUrls(uploadedUrls);
      setPendingFiles([]);
      
      if (onChange) {
        onChange(uploadedUrls.join(', '));
      }
      
      showSuccessMessage('upload');
      return uploadedUrls;
      
    } finally {
      setUploading(false);
      setCurrentUploadIndex(-1);
      setUploadProgress(0);
    }
  };

  // Expose uploadAllFiles method to parent via ref
  useImperativeHandle(ref, () => ({
    uploadAllFiles
  }));

  // Handle file selection (just preview, don't upload yet)
  const beforeUpload = (file, fileList) => {
    // Validate file
    if (!validateFile(file)) {
      return false;
    }
    
    // If this is the last file in the selection, add all valid files to pending
    if (fileList[fileList.length - 1] === file) {
      const validFiles = fileList.filter(f => validateFile(f));
      const newPendingFiles = validFiles.map(f => ({
        file: f,
        name: f.name,
        size: f.size,
        preview: URL.createObjectURL(f)
      }));
      
      setPendingFiles(prev => [...prev, ...newPendingFiles]);
    }
    
    return false; // Prevent default upload
  };

  // Remove specific image from uploaded images
  const handleRemove = (urlToRemove) => {
    const newUrls = imageUrls.filter(url => url !== urlToRemove);
    setImageUrls(newUrls);
    
    if (onChange) {
      onChange(newUrls.length > 0 ? newUrls.join(', ') : '');
    }
  };

  // Remove file from pending list (before upload)
  const handleRemoveFromPending = (index) => {
    const newPending = pendingFiles.filter((_, i) => i !== index);
    setPendingFiles(newPending);
    
    // Revoke object URL to free memory
    if (pendingFiles[index]?.preview) {
      URL.revokeObjectURL(pendingFiles[index].preview);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(item => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [pendingFiles]);

  // Custom upload props
  const uploadProps = {
    beforeUpload,
    fileList: [],
    accept,
    disabled: disabled || uploading,
    showUploadList: false,
    multiple: true, // Enable multiple file selection
    // Mobile-specific props
    capture: isMobile ? 'environment' : undefined, // Enable camera on mobile
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Pending Files - Show files waiting to be uploaded */}
      {pendingFiles.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Text strong style={{ 
            color: 'rgba(255, 255, 255, 0.85)',
            display: 'block',
            marginBottom: '8px'
          }}>
            Ready to Upload ({pendingFiles.length})
          </Text>
          
          <Row gutter={[8, 8]}>
            {pendingFiles.map((item, index) => (
              <Col key={index} xs={12} sm={8} md={6}>
                <Card
                  size="small"
                  style={{ 
                    background: '#262626',
                    border: '1px solid #303030'
                  }}
                  styles={{ body: { padding: '8px' } }}
                >
                  <div style={{ position: 'relative' }}>
                    <img 
                      src={item.preview} 
                      alt={item.name}
                      style={{ 
                        width: '100%', 
                        height: '80px', 
                        objectFit: 'cover',
                        borderRadius: '4px'
                      }}
                    />
                    {!uploading && (
                      <Button
                        type="primary"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveFromPending(index)}
                        style={{ 
                          position: 'absolute',
                          top: '4px',
                          right: '4px'
                        }}
                      />
                    )}
                    {uploading && currentUploadIndex === index && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}>
                        <Progress 
                          type="circle" 
                          percent={uploadProgress} 
                          size={40}
                          strokeColor="#1890ff"
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'rgba(255, 255, 255, 0.65)',
                    marginTop: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.name}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

        {/* Image Preview Grid - Successfully uploaded images */}
        {imageUrls.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <Text strong style={{ 
              color: 'rgba(255, 255, 255, 0.85)',
              display: 'block',
              marginBottom: '8px'
            }}>
              Uploaded Images ({imageUrls.length})
            </Text>
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
                        style={{ 
                          color: '#1890ff',
                          fontSize: isMobile ? '18px' : '14px',
                          padding: isMobile ? '8px' : '4px'
                        }}
                      />,
                      <DeleteOutlined 
                        key="delete" 
                        onClick={() => handleRemove(url)}
                        style={{ 
                          color: '#ff4d4f',
                          fontSize: isMobile ? '18px' : '14px',
                          padding: isMobile ? '8px' : '4px'
                        }}
                        disabled={uploading}
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
            style={{ 
              width: '100%',
              minHeight: isMobile ? '44px' : 'auto',
              fontSize: isMobile ? '16px' : '14px'
            }}
            size={isMobile ? 'large' : 'middle'}
            type="dashed"
          >
            {imageUrls.length === 0 && pendingFiles.length === 0 
              ? 'Select Images' 
              : 'Add More Images'}
          </Button>
        </Upload>

      {/* Help Text */}
      <div style={{ marginTop: '8px' }}>
        <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)' }}>
          Select multiple images at once (max {maxSize}MB each). Images will be uploaded when you submit the form.
        </Text>
      </div>
    </div>
  );
});

export default FileUpload;