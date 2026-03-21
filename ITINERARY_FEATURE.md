# Visit Itinerary Generator

## Overview
The Visit Itinerary Generator is an internal tool accessible from the navbar's "Itinerary" button. It allows users to quickly generate formatted visit itineraries for multiple warehouses by entering comma-separated warehouse IDs.

## How to Use

1. **Open the Tool**
   - Click the "Itinerary" button in the navbar (desktop or mobile)
   - The tool will automatically load warehouse data when opened

2. **Enter Warehouse IDs**
   - Type comma-separated warehouse IDs in the input field
   - Example: `1, 5, 12` or `3,7,15,22`

3. **Generate Itinerary**
   - Click the "Generate Itinerary" button or press Enter
   - The tool will look up the warehouses and format them

4. **Copy to Clipboard**
   - Click the "Copy" button to copy the formatted itinerary
   - Share it via WhatsApp, email, or any messaging platform

## Output Format

Each warehouse in the itinerary is formatted as:

```
1. WH-{id} - {contactPerson} ({contactNumber})
   - {totalSpaceSqft} sq ft | {numberOfDocks} docks | {compliances} | ₹{ratePerSqft}/sq ft
   - {googleLocation}

2. WH-{id} - ...
```

### Example Output

```
1. WH-5 - John Doe (9876543210)
   - 50000 sq ft | 4 docks | Fire NOC, CCTV | ₹22/sq ft
   - https://maps.google.com/?q=12.9716,77.5946

2. WH-12 - Jane Smith (9123456789)
   - 75000 + 25000 sq ft | 6 docks | Fire NOC | ₹18/sq ft
   - https://maps.google.com/?q=13.0827,80.2707
```

## Features

- **Lazy Loading**: Warehouse data is only fetched when the modal is opened
- **Caching**: Data is cached for subsequent uses during the session
- **Error Handling**: Gracefully handles missing IDs and invalid inputs
- **Validation**: Shows warnings for invalid or not-found warehouse IDs
- **Responsive**: Works on both mobile and desktop devices

## Technical Details

### Implementation
- **File Modified**: `Frontend_Repository/src/components/MobileHeader.jsx`
- **Service Used**: `warehouseService.getAll()`
- **State Management**: Local component state with React hooks

### Data Fields Used
- `id` - Warehouse identifier
- `contactPerson` - Owner/contact name
- `contactNumber` - Phone number
- `totalSpaceSqft` - Size (handles both array and single values)
- `numberOfDocks` - Dock count
- `compliances` - Compliance summary (from nested WarehouseData)
- `ratePerSqft` - Headline rent
- `googleLocation` - Google Maps pin URL

### Error States
- Loading state while fetching warehouse data
- Validation for empty input
- Warning for invalid IDs
- Warning for IDs not found in database
- Error handling for network failures
