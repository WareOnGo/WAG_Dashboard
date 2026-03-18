import { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from 'react';
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
}, ref) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageUrls, setImageUrls] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // Files waiting to be uploaded
  const [currentUploadIndex, setCurrentUploadIndex] = useState(-1);
  const { isMobile } = useViewport();

  const { handleUploadError, showSuccessMessage, showErrorMessage } = useErrorHandler();

  // Refs to hold latest state — prevents stale closures when uploadAllFiles
  // is called from the parent via ref (e.g. after a confirmation modal on mobile)
  const pendingFilesRef = useRef(pendingFiles);
  const imageUrlsRef = useRef(imageUrls);
  const onChangeRef = useRef(onChange);

  useEffect(() => { pendingFilesRef.current = pendingFiles; }, [pendingFiles]);
  useEffect(() => { imageUrlsRef.current = imageUrls; }, [imageUrls]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

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
    // Check if file exists
    if (!file) {
      return false;
    }

    // On mobile, HEIC files might not have the correct MIME type
    const isImage = file.type.startsWith('image/') || 
                    file.type === '' || // Some mobile browsers don't set type for HEIC
                    file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif)$/);
    
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
        
        // Handle MIME type for mobile - Android sometimes sends application/octet-stream
        let contentType = file.type;
        if (!contentType || contentType === 'application/octet-stream') {
          // Infer type from extension
          const ext = file.name.toLowerCase().split('.').pop();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'heic': 'image/heic',
            'heif': 'image/heif'
          };
          contentType = mimeTypes[ext] || 'image/jpeg';
        }
        
        const { uploadUrl, imageUrl } = await warehouseService.getPresignedUrl(contentType);
        
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
          // Use the corrected content type
          xhr.setRequestHeader('Content-Type', contentType);
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
  // Reads from refs to avoid stale closures — this function may be called
  // from a parent component via ref after arbitrary re-renders (e.g. mobile
  // confirmation modal flow), so it must always see the latest state.
  const uploadAllFiles = useCallback(async () => {
    const currentPending = pendingFilesRef.current;
    const currentImageUrls = imageUrlsRef.current;

    if (currentPending.length === 0) {
      return currentImageUrls; // Return existing URLs if no pending files
    }

    setUploading(true);
    const uploadedUrls = [...currentImageUrls];

    try {
      for (let i = 0; i < currentPending.length; i++) {
        const item = currentPending[i];
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

      if (onChangeRef.current) {
        onChangeRef.current(uploadedUrls.join(', '));
      }

      showSuccessMessage('upload');
      return uploadedUrls;

    } finally {
      setUploading(false);
      setCurrentUploadIndex(-1);
      setUploadProgress(0);
    }
  }, [uploadSingleFile, showSuccessMessage]);

  // Expose uploadAllFiles method to parent via ref
  useImperativeHandle(ref, () => ({
    uploadAllFiles
  }));

  // Handle file selection (just preview, don't upload yet)
  const beforeUpload = (file) => {
    // Validate file
    if (!validateFile(file)) {
      return false;
    }

    // Add each valid file to pending individually
    // Note: avoid batching via fileList reference equality check —
    // on Android Chrome, fileList entries may not be the same reference as file,
    // causing files to silently never get added to pendingFiles.
    let previewUrl;
    try {
      previewUrl = URL.createObjectURL(file);
    } catch (error) {
      console.error('Failed to create preview URL:', error);
      previewUrl = null;
    }

    setPendingFiles(prev => [...prev, {
      file,
      name: file.name,
      size: file.size,
      preview: previewUrl
    }]);

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
    accept: 'image/*,image/heic,image/heif', // Include HEIC/HEIF for iOS
    disabled: disabled || uploading,
    showUploadList: false,
    multiple: true, // Enable multiple file selection
    capture: false, // Don't force camera on mobile, allow gallery selection
    openFileDialogOnClick: true, // Ensure file dialog opens on click
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
                    {item.preview ? (
                      <img 
                        src={item.preview} 
                        alt={item.name}
                        style={{ 
                          width: '100%', 
                          height: '80px', 
                          objectFit: 'cover',
                          borderRadius: '4px'
                        }}
                        onError={(e) => {
                          // Fallback if preview fails to load
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '80px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#1f1f1f',
                        borderRadius: '4px',
                        color: 'rgba(255, 255, 255, 0.45)'
                      }}>
                        📷 {item.name.split('.').pop().toUpperCase()}
                      </div>
                    )}
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
              minHeight: isMobile ? '48px' : 'auto',
              fontSize: isMobile ? '16px' : '14px',
              touchAction: 'manipulation', // Prevent double-tap zoom on mobile
              WebkitTapHighlightColor: 'transparent', // Remove tap highlight on iOS
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