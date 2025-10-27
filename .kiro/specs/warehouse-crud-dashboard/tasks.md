# Implementation Plan

- [x] 1. Set up project structure and core configuration
  - Initialize React project with Vite
  - Install required dependencies (axios, antd, react-router-dom)
  - Configure environment variables for API base URL
  - Set up basic project folder structure (components, services, utils)
  - _Requirements: 1.2, 2.4, 3.4_

- [x] 2. Create API service layer
  - [x] 2.1 Implement warehouse service with CRUD operations
    - Create warehouseService.js with getAll, create, update, delete methods
    - Configure axios base URL and error handling
    - Implement proper request/response formatting
    - _Requirements: 1.1, 1.3, 2.3, 3.3, 4.2_
  
  - [x] 2.2 Implement file upload service methods
    - Add getPresignedUrl method to warehouse service
    - Add uploadFileToR2 method for direct R2 upload
    - Handle file upload error scenarios
    - _Requirements: 5.2, 5.3, 5.4_

- [x] 3. Build core Dashboard component
  - [x] 3.1 Create Dashboard layout and warehouse list display
    - Implement Dashboard.jsx with Ant Design Table
    - Add warehouse data fetching on component mount
    - Display warehouse and warehouseData information in table columns
    - Add loading states and error handling for data fetching
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  
  - [x] 3.2 Implement delete functionality
    - Add delete confirmation modal
    - Handle DELETE API calls with 204 status code validation
    - Update local state after successful deletion
    - Display appropriate success/error messages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Create warehouse form component
  - [x] 4.1 Build WarehouseForm component structure
    - Create form layout with Ant Design Form components
    - Implement form fields for warehouse and warehouseData
    - Add form validation rules
    - Handle form submission with proper payload formatting
    - _Requirements: 2.1, 2.2, 3.1, 3.2_
  
  - [x] 4.2 Integrate create and update operations
    - Handle form submission for both create and update modes
    - Format payload with nested warehouseData structure
    - Update Dashboard state after successful operations
    - Handle API validation errors with issues array display
    - _Requirements: 2.3, 2.5, 3.3, 3.5, 6.1_

- [x] 5. Implement file upload functionality
  - [x] 5.1 Create FileUpload component
    - Build file selection interface with Ant Design Upload
    - Add file type and size validation
    - Implement upload progress indicators
    - _Requirements: 5.1_
  
  - [x] 5.2 Implement two-step upload flow
    - Handle presigned URL request with file contentType
    - Execute direct PUT request to R2 uploadUrl
    - Store final imageUrl in component state
    - Integrate imageUrl with form submission as photos field
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [x] 6. Add comprehensive error handling
  - [x] 6.1 Implement error display system
    - Create error notification system using Ant Design messages
    - Handle 400 status responses with issues array parsing
    - Display 404 error messages for warehouse not found
    - Add network error handling for connection issues
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Create main App component and routing
  - [x] 7.1 Set up App.jsx with routing
    - Create root App component
    - Set up React Router for navigation
    - Add global error boundary
    - Configure Ant Design theme and layout
    - _Requirements: 1.2_

- [ ]* 8. Add testing suite
  - [ ]* 8.1 Write unit tests for API service
    - Test all CRUD operations with mocked axios responses
    - Test file upload flow with presigned URL process
    - Verify error handling for different API response scenarios
    - _Requirements: 1.1, 2.3, 4.2, 5.2, 5.3_
  
  - [ ]* 8.2 Write component integration tests
    - Test Dashboard component CRUD workflows
    - Test WarehouseForm submission and validation
    - Test FileUpload component upload flow
    - Test error message display functionality
    - _Requirements: 1.5, 2.5, 4.5, 6.4_