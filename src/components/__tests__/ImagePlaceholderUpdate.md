# Image Placeholder Enhancement

## Changes Made

### ✅ Added Grey Placeholder for Missing Images

**Problem:** Cards without images looked inconsistent and empty in the card view.

**Solution:** Added a cohesive grey placeholder that displays when warehouses don't have images.

### Implementation Details

#### 1. **WarehouseCard.jsx Changes**
- Modified the image section to always render an image area
- Added conditional rendering: show image if available, otherwise show placeholder
- Placeholder includes a warehouse icon and "No Image" text

#### 2. **WarehouseCard.css Changes**
- Added `.warehouse-card__image-placeholder` styles
- Placeholder features:
  - Grey background with subtle transparency
  - Dashed border for visual distinction
  - Centered warehouse icon and text
  - Consistent 120px height (100px on mobile)
  - Hover effects that match the card's interaction style

#### 3. **Visual Design**
- **Background**: `rgba(255, 255, 255, 0.05)` - subtle grey
- **Border**: `1px dashed rgba(255, 255, 255, 0.15)` - dashed outline
- **Icon**: 32px warehouse icon (28px on mobile)
- **Text**: "NO IMAGE" in uppercase with letter spacing
- **Hover**: Slightly brighter background and border

#### 4. **Responsive Design**
- Mobile optimization: smaller icon and text
- High contrast mode support
- Consistent with existing card styling

### Benefits

1. **Visual Consistency**: All cards now have the same visual structure
2. **Professional Appearance**: No more empty spaces in the card layout
3. **User Experience**: Clear indication that no image is available
4. **Accessibility**: Proper contrast and readable text
5. **Cohesive Design**: Matches the overall dark theme and styling

### Result

Cards now display a professional grey placeholder with a warehouse icon and "No Image" text when images are not available, making the card view look cohesive and complete across all warehouse entries.