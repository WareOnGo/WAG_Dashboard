# Requirements Document

## Introduction

A CRUD (Create, Read, Update, Delete) admin dashboard for managing company warehouse data. The system provides a React-based frontend interface that communicates with a Node.js/Express API backend to manage warehouse information including basic details and associated data with image upload capabilities.

## Glossary

- **Dashboard**: The main administrative interface for warehouse management
- **Warehouse**: The primary entity containing basic warehouse information
- **WarehouseData**: Detailed information associated with a warehouse in a 1-to-1 relationship
- **API**: The Node.js/Express backend service at http://localhost:3001/api
- **Presigned URL Flow**: A two-step process for uploading files where the frontend gets upload credentials from the backend, uploads directly to storage, then uses the resulting URL
- **CRUD Operations**: Create, Read, Update, Delete operations for warehouse management

## Requirements

### Requirement 1

**User Story:** As an admin user, I want to view all warehouses in a dashboard interface, so that I can see an overview of all warehouse data.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Dashboard SHALL display a list of all warehouses retrieved from the API
2. THE Dashboard SHALL use Ant Design components for consistent UI presentation
3. THE Dashboard SHALL make GET requests to http://localhost:3001/api/warehouses to retrieve warehouse data
4. THE Dashboard SHALL display both Warehouse and WarehouseData information in the list view
5. IF the API returns an error, THEN THE Dashboard SHALL display an appropriate error message to the user

### Requirement 2

**User Story:** As an admin user, I want to create new warehouse records, so that I can add new warehouses to the system.

#### Acceptance Criteria

1. WHEN the user clicks create warehouse, THE Dashboard SHALL display a form for entering warehouse information
2. THE Dashboard SHALL collect both Warehouse and WarehouseData information in a single form
3. WHEN submitting the form, THE Dashboard SHALL send a POST request to /api/warehouses with warehouseData nested under lowercase key
4. THE Dashboard SHALL use axios for all API communication
5. IF the API returns a 400 status with issues array, THEN THE Dashboard SHALL display validation errors to the user

### Requirement 3

**User Story:** As an admin user, I want to update existing warehouse records, so that I can modify warehouse information when needed.

#### Acceptance Criteria

1. WHEN the user selects edit on a warehouse, THE Dashboard SHALL populate a form with existing warehouse data
2. THE Dashboard SHALL allow modification of both Warehouse and WarehouseData fields
3. WHEN submitting updates, THE Dashboard SHALL send a PUT request to /api/warehouses/:id with warehouseData nested under lowercase key
4. THE Dashboard SHALL handle 404 responses by displaying "warehouse not found" messages
5. THE Dashboard SHALL refresh the warehouse list after successful updates

### Requirement 4

**User Story:** As an admin user, I want to delete warehouse records, so that I can remove warehouses that are no longer needed.

#### Acceptance Criteria

1. WHEN the user clicks delete on a warehouse, THE Dashboard SHALL prompt for confirmation before deletion
2. THE Dashboard SHALL send a DELETE request to /api/warehouses/:id when confirmed
3. WHEN the API returns 204 status code, THE Dashboard SHALL consider the deletion successful
4. THE Dashboard SHALL remove the deleted warehouse from the display without requiring a page refresh
5. THE Dashboard SHALL handle the 204 response with no response body correctly

### Requirement 5

**User Story:** As an admin user, I want to upload warehouse photos, so that I can associate images with warehouse records.

#### Acceptance Criteria

1. WHEN the user selects a file, THE Dashboard SHALL capture the file and its contentType
2. THE Dashboard SHALL make a POST request to /api/warehouses/presigned-url with the contentType
3. WHEN the API responds with uploadUrl and imageUrl, THE Dashboard SHALL make a PUT request directly to the uploadUrl with the raw file
4. THE Dashboard SHALL store the imageUrl in component state after successful upload
5. WHEN submitting the warehouse form, THE Dashboard SHALL include the imageUrl string as the photos field value

### Requirement 6

**User Story:** As an admin user, I want consistent error handling throughout the application, so that I can understand what went wrong when operations fail.

#### Acceptance Criteria

1. WHEN the API returns a 400 status, THE Dashboard SHALL parse and display the issues array from the response body
2. WHEN the API returns a 404 status, THE Dashboard SHALL display "warehouse not found" messaging
3. WHEN network errors occur, THE Dashboard SHALL display appropriate connection error messages
4. THE Dashboard SHALL use Ant Design notification or message components for error display
5. THE Dashboard SHALL clear error messages when users retry operations successfully