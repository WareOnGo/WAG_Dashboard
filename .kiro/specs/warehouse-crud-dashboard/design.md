# Design Document

## Overview

The Warehouse CRUD Dashboard is a React-based single-page application that provides administrative functionality for managing warehouse data. The application follows a clean architecture pattern with separated concerns for API communication, state management, and UI components. It integrates with a Node.js/Express backend API and implements a sophisticated two-step file upload process using Cloudflare R2 storage.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React SPA     │    │  Node.js/Express │    │   Supabase DB   │
│                 │◄──►│      API         │◄──►│   (PostgreSQL)  │
│  - Dashboard    │    │                  │    │                 │
│  - Forms        │    │  - CRUD Routes   │    │  - Warehouse    │
│  - File Upload  │    │  - Validation    │    │  - WarehouseData│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         │              ┌──────────────────┐
         └──────────────►│  Cloudflare R2   │
                         │   File Storage   │
                         └──────────────────┘
```

### Frontend Architecture Layers

1. **Presentation Layer**: React components using Ant Design
2. **Service Layer**: API communication and business logic
3. **State Management**: React hooks for local state
4. **Utility Layer**: Helper functions and constants

## Components and Interfaces

### Core Components

#### App.jsx
- Root application component
- Sets up routing and global providers
- Manages application-wide state and error boundaries

#### Dashboard.jsx
- Main warehouse management interface
- Displays warehouse list in Ant Design Table
- Handles CRUD operations through modal forms
- Manages loading states and error handling

#### WarehouseForm.jsx
- Reusable form component for create/edit operations
- Implements the two-step file upload flow
- Handles form validation and submission
- Manages nested warehouseData structure

#### FileUpload.jsx
- Specialized component for image upload functionality
- Implements presigned URL flow
- Provides upload progress feedback
- Handles file validation (type, size)

### API Service Layer

#### warehouseService.js
```javascript
export const warehouseService = {
  // CRUD operations
  getAll: () => axios.get(`${API_BASE_URL}/warehouses`),
  create: (data) => axios.post(`${API_BASE_URL}/warehouses`, data),
  update: (id, data) => axios.put(`${API_BASE_URL}/warehouses/${id}`, data),
  delete: (id) => axios.delete(`${API_BASE_URL}/warehouses/${id}`),
  
  // File upload operations
  getPresignedUrl: (contentType) => 
    axios.post(`${API_BASE_URL}/warehouses/presigned-url`, { contentType }),
  uploadFileToR2: (uploadUrl, file) => 
    axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type } })
};
```

### State Management Strategy

#### Global State (Dashboard Level)
- `warehouses`: Array of all warehouse records
- `loading`: Boolean for API operation states
- `error`: Error message display

#### Form State (Component Level)
- `formData`: Current form values
- `uploading`: File upload progress state
- `imageUrl`: Processed image URL from upload flow

## Data Models

### Frontend Data Structures

#### Warehouse Display Model
```javascript
{
  id: number,
  warehouseType: string,
  address: string,
  city: string,
  state: string,
  zone: string,
  contactPerson: string,
  contactNumber: string,
  totalSpaceSqft: number[],
  compliances: string,
  ratePerSqft: string,
  uploadedBy: string,
  photos: string, // URL string
  createdAt: string,
  WarehouseData: {
    id: number,
    latitude: number,
    longitude: number,
    fireNocAvailable: boolean,
    warehouseId: number,
    // additional fields...
  }
}
```

#### API Payload Model (Create/Update)
```javascript
{
  warehouseType: string,
  address: string,
  city: string,
  // ... other warehouse fields
  photos: string, // Final imageUrl from upload flow
  warehouseData: { // lowercase key for API
    latitude: number,
    longitude: number,
    fireNocAvailable: boolean,
    // ... other data fields
  }
}
```

## File Upload Flow Implementation

### Two-Step Upload Process

1. **File Selection & Validation**
   - User selects file through Ant Design Upload component
   - Validate file type (images only) and size limits
   - Store file in component state for processing

2. **Presigned URL Request**
   - Extract contentType from selected file
   - POST to `/api/warehouses/presigned-url` with contentType
   - Receive `uploadUrl` and `imageUrl` from response

3. **Direct R2 Upload**
   - PUT request directly to `uploadUrl` with raw file data
   - Set appropriate Content-Type header
   - Handle upload progress and errors

4. **Form Submission**
   - Store `imageUrl` in form state
   - Include `imageUrl` as `photos` field in main form submission
   - Submit complete form data to warehouse API

### Upload State Management
```javascript
const [uploadState, setUploadState] = useState({
  file: null,
  uploading: false,
  imageUrl: null,
  error: null
});
```

## Error Handling

### API Error Response Handling

#### 400 Bad Request (Validation Errors)
```javascript
// Response format: { error: string, issues: Array }
if (error.response?.status === 400) {
  const { issues } = error.response.data;
  // Display field-specific validation errors
  issues.forEach(issue => {
    showFieldError(issue.path[0], issue.message);
  });
}
```

#### 404 Not Found
```javascript
if (error.response?.status === 404) {
  showNotification('error', 'Warehouse not found');
}
```

#### 204 No Content (Delete Success)
```javascript
if (response.status === 204) {
  // No response body - success confirmed by status code
  showNotification('success', 'Warehouse deleted successfully');
  removeFromLocalState(warehouseId);
}
```

### Error Display Strategy
- Use Ant Design notification system for global messages
- Display field-level errors inline with form inputs
- Provide retry mechanisms for network failures
- Clear errors on successful operations

## User Interface Design

### Layout Structure
- Header with application title and actions
- Main content area with warehouse table
- Modal overlays for create/edit forms
- Loading states with Ant Design Spin components

### Table Configuration
- Sortable columns for key warehouse attributes
- Action column with Edit/Delete buttons
- Pagination for large datasets
- Search/filter capabilities

### Form Design
- Two-column layout for optimal space usage
- Grouped related fields (basic info, location data, etc.)
- File upload area with drag-and-drop support
- Clear validation feedback

## Testing Strategy

### Unit Testing Focus Areas
1. **API Service Functions**
   - Test all CRUD operations
   - Mock axios responses for different scenarios
   - Verify correct payload formatting

2. **File Upload Logic**
   - Test presigned URL flow
   - Verify direct R2 upload functionality
   - Handle upload failures gracefully

3. **Form Validation**
   - Test required field validation
   - Verify nested warehouseData structure
   - Test error message display

### Integration Testing
1. **End-to-End CRUD Flows**
   - Complete create warehouse workflow
   - Update existing warehouse data
   - Delete warehouse with confirmation

2. **File Upload Integration**
   - Full upload flow from selection to form submission
   - Error handling during upload process
   - Image URL integration with form data

### Error Scenario Testing
- Network connectivity issues
- API validation failures
- File upload interruptions
- Large file handling

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Load warehouse data on demand
2. **Debounced Search**: Prevent excessive API calls during search
3. **Image Optimization**: Validate file sizes before upload
4. **Caching**: Store frequently accessed data in component state

### Bundle Size Management
- Tree-shake unused Ant Design components
- Optimize image assets and icons
- Use dynamic imports for large components

## Security Considerations

### Frontend Security Measures
1. **Input Validation**: Client-side validation before API calls
2. **File Type Restrictions**: Limit uploads to image files only
3. **URL Validation**: Verify presigned URLs before upload
4. **Error Message Sanitization**: Prevent XSS through error display

### API Communication Security
- Use HTTPS in production environment
- Validate all API responses before processing
- Handle authentication tokens (when implemented)
- Sanitize user inputs before API submission