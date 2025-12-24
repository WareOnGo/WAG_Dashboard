import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Row,
  Col,
  Typography,
  Space,
  Spin,
  Collapse
} from 'antd';
import { SaveOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import FileUpload from './FileUpload';
import ResponsiveModal from './ResponsiveModal';
import './ResponsiveModal.css';
import './WarehouseForm.css';
import {
  clearErrors
} from '../utils/errorHandler';
import { useViewport } from '../hooks/useViewport';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

const WarehouseForm = ({
  visible,
  onCancel,
  onSubmit,
  initialData = null,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [_focusedField, setFocusedField] = useState(null);
  const { isMobile } = useViewport();

  // Reset form when modal opens/closes or initial data changes
  useEffect(() => {
    if (visible) {
      if (initialData) {
        // Populate form with existing data for edit mode
        const formData = {
          // Warehouse fields
          warehouseOwnerType: initialData.warehouseOwnerType,
          warehouseType: initialData.warehouseType,
          address: initialData.address,
          googleLocation: initialData.googleLocation,
          city: initialData.city,
          state: initialData.state,
          postalCode: initialData.postalCode,
          zone: initialData.zone,
          contactPerson: initialData.contactPerson,
          contactNumber: initialData.contactNumber,
          totalSpaceSqft: Array.isArray(initialData.totalSpaceSqft)
            ? initialData.totalSpaceSqft
            : [initialData.totalSpaceSqft].filter(Boolean),
          offeredSpaceSqft: initialData.offeredSpaceSqft,
          numberOfDocks: initialData.numberOfDocks,
          clearHeightFt: initialData.clearHeightFt,
          compliances: initialData.compliances,
          otherSpecifications: initialData.otherSpecifications,
          ratePerSqft: initialData.ratePerSqft,
          availability: initialData.availability,
          uploadedBy: initialData.uploadedBy,
          visibility: initialData.visibility === true || initialData.visibility === 'true' || initialData.visibility === 1,
          isBroker: initialData.isBroker,
          photos: initialData.photos,

          // WarehouseData fields (nested)
          latitude: initialData.WarehouseData?.latitude || initialData.warehouseData?.latitude,
          longitude: initialData.WarehouseData?.longitude || initialData.warehouseData?.longitude,
          fireNocAvailable: initialData.WarehouseData?.fireNocAvailable === true || initialData.WarehouseData?.fireNocAvailable === "true" ||
            initialData.warehouseData?.fireNocAvailable === true || initialData.warehouseData?.fireNocAvailable === "true",
          fireSafetyMeasures: initialData.WarehouseData?.fireSafetyMeasures || initialData.warehouseData?.fireSafetyMeasures,
          landType: initialData.WarehouseData?.landType || initialData.warehouseData?.landType,
          approachRoadWidth: initialData.WarehouseData?.approachRoadWidth || initialData.warehouseData?.approachRoadWidth,
          dimensions: initialData.WarehouseData?.dimensions || initialData.warehouseData?.dimensions,
          parkingDockingSpace: initialData.WarehouseData?.parkingDockingSpace || initialData.warehouseData?.parkingDockingSpace,
          pollutionZone: initialData.WarehouseData?.pollutionZone || initialData.warehouseData?.pollutionZone,
          powerKva: initialData.WarehouseData?.powerKva || initialData.warehouseData?.powerKva,
          vaastuCompliance: initialData.WarehouseData?.vaastuCompliance === true || initialData.WarehouseData?.vaastuCompliance === "true" ||
            initialData.warehouseData?.vaastuCompliance === true || initialData.warehouseData?.vaastuCompliance === "true",
        };
        form.setFieldsValue(formData);
      } else {
        // Reset form for create mode with some sensible defaults
        form.resetFields();
        // Set default values for better UX
        form.setFieldsValue({
          totalSpaceSqft: [1000], // Default space value
          visibility: true, // Default to visible
          fireNocAvailable: false, // Default to false
          vaastuCompliance: false // Default to false
        });
      }
    }
  }, [visible, initialData, form]);

  const handleSubmit = async (values) => {
    setSubmitting(true);

    try {
      // Show loading feedback on mobile
      if (isMobile) {
        // Scroll to top to show loading state
        const modalContent = document.querySelector('.responsive-modal [tabindex="-1"]');
        if (modalContent) {
          modalContent.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }

      // Format payload with nested warehouseData structure
      const payload = {
        // Main warehouse fields
        warehouseOwnerType: values.warehouseOwnerType || null,
        warehouseType: values.warehouseType,
        address: values.address,
        googleLocation: values.googleLocation || null,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode || null,
        zone: values.zone,
        contactPerson: values.contactPerson,
        contactNumber: values.contactNumber,
        totalSpaceSqft: Array.isArray(values.totalSpaceSqft)
          ? values.totalSpaceSqft.filter(val => val != null && val > 0)
          : [values.totalSpaceSqft].filter(val => val != null && val > 0), // API expects array of positive integers
        offeredSpaceSqft: values.offeredSpaceSqft ? String(values.offeredSpaceSqft) : null,
        numberOfDocks: values.numberOfDocks ? String(values.numberOfDocks) : null,
        clearHeightFt: values.clearHeightFt ? String(values.clearHeightFt) : null,
        compliances: values.compliances,
        otherSpecifications: values.otherSpecifications || null,
        ratePerSqft: values.ratePerSqft ? String(values.ratePerSqft) : null,
        availability: values.availability || null,
        uploadedBy: values.uploadedBy,
        visibility: Boolean(values.visibility),
        isBroker: values.isBroker || null,
        photos: values.photos || null,

        // Nested warehouseData (lowercase key as per API requirement)
        warehouseData: {
          latitude: values.latitude || null,
          longitude: values.longitude || null,
          fireNocAvailable: Boolean(values.fireNocAvailable), // API expects boolean
          fireSafetyMeasures: values.fireSafetyMeasures || null,
          landType: values.landType || null,
          approachRoadWidth: values.approachRoadWidth ? String(values.approachRoadWidth) : null,
          dimensions: values.dimensions || null,
          parkingDockingSpace: values.parkingDockingSpace || null,
          pollutionZone: values.pollutionZone || null,
          powerKva: values.powerKva ? String(values.powerKva) : null,
          vaastuCompliance: values.vaastuCompliance ? "true" : null, // API expects string, send null if false
        }
      };

      await onSubmit(payload);
      form.resetFields();
      // Success message will be shown by parent component
    } catch (error) {
      // Error handling will be done by parent component
      if (import.meta.env.DEV) {
        console.error('Form submission error:', error);
      }

      // On mobile, scroll to first error field if validation fails
      if (isMobile && error.errorFields) {
        setTimeout(() => {
          const firstErrorField = error.errorFields[0]?.name[0];
          if (firstErrorField) {
            const element = document.querySelector(`[data-field="${firstErrorField}"]`);
            if (element) {
              element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
              element.focus();
            }
          }
        }, 100);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Render functions for form sections
  const renderBasicInformation = (isMobileLayout) => (
    <>
      {!isMobileLayout && (
        <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
          Basic Information
        </Title>
      )}

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="warehouseOwnerType"
            label={<span style={{ color: 'var(--text-secondary)' }}>Warehouse Owner Type</span>}
          >
            <Select
              placeholder="Select owner type"
              size={isMobileLayout ? 'large' : 'middle'}
            >
              <Option value="Owner">Owner</Option>
              <Option value="Tenant">Tenant</Option>
              <Option value="Broker">Broker</Option>
              <Option value="Agent">Agent</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="warehouseType"
            label={<span style={{ color: 'var(--text-secondary)' }}>Warehouse Type <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.warehouseType}
          >
            <Input
              placeholder="Enter warehouse type (e.g., Cold Storage, Dry Storage)"
              {...getInputProps('warehouseType', 'text', 'text')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="zone"
            label={<span style={{ color: 'var(--text-secondary)' }}>Zone <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={[validationRules.required]}
          >
            <Select
              placeholder="Select zone"
              size={isMobileLayout ? 'large' : 'middle'}
            >
              <Option value="North">North</Option>
              <Option value="South">South</Option>
              <Option value="East">East</Option>
              <Option value="West">West</Option>
              <Option value="Central">Central</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {/* Address Information */}
      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24}>
          <Form.Item
            name="address"
            label={<span style={{ color: 'var(--text-secondary)' }}>Address <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.address}
          >
            <TextArea
              placeholder="Enter complete address"
              rows={isMobileLayout ? 3 : 2}
              {...getInputProps('address', 'text', 'text')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="city"
            label={<span style={{ color: 'var(--text-secondary)' }}>City <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.city}
          >
            <Input
              placeholder="Enter city"
              {...getInputProps('city', 'text', 'text')}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="state"
            label={<span style={{ color: 'var(--text-secondary)' }}>State <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.state}
          >
            <Input
              placeholder="Enter state"
              {...getInputProps('state', 'text', 'text')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="postalCode"
            label={<span style={{ color: 'var(--text-secondary)' }}>Postal Code</span>}
          >
            <Input
              placeholder="Enter postal code"
              {...getInputProps('postalCode', 'numeric', 'text')}
              pattern="[0-9]*"
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="googleLocation"
            label={<span style={{ color: 'var(--text-secondary)' }}>Google Location URL</span>}
          >
            <Input
              placeholder="Enter Google Maps URL"
              {...getInputProps('googleLocation', 'url', 'url')}
            />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const renderContactInformation = (isMobileLayout) => (
    <>
      {!isMobileLayout && (
        <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
          Contact Information
        </Title>
      )}

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="contactPerson"
            label={<span style={{ color: 'var(--text-secondary)' }}>Contact Person <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.contactPerson}
          >
            <Input
              placeholder="Enter contact person name"
              {...getInputProps('contactPerson', 'text', 'text')}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="contactNumber"
            label={<span style={{ color: 'var(--text-secondary)' }}>Contact Number <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={[validationRules.required, validationRules.phone]}
          >
            <Input
              placeholder="Enter 10-digit phone number"
              {...getInputProps('contactNumber', 'tel', 'tel')}
              maxLength={15}
            />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const renderWarehouseDetails = (isMobileLayout) => (
    <>
      {!isMobileLayout && (
        <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
          Warehouse Details
        </Title>
      )}

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            label={<span style={{ color: 'var(--text-secondary)' }}>Total Space (sq ft) <span style={{ color: '#ff4d4f' }}>*</span></span>}
            required
          >
            <Form.List
              name="totalSpaceSqft"
              rules={[
                {
                  validator: async (_, spaces) => {
                    if (!spaces || spaces.length < 1) {
                      return Promise.reject(new Error('At least one space value is required'));
                    }
                  },
                },
              ]}
            >
              {(fields, { add, remove }, { errors }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8, width: '100%' }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={name}
                        rules={[
                          { required: true, message: 'Space value is required' },
                          { type: 'number', min: 1, message: 'Must be a positive number' }
                        ]}
                        style={{ flex: 1, marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="Enter space"
                          style={{ width: '100%' }}
                          size={isMobileLayout ? 'large' : 'middle'}
                          min={1}
                          inputMode="numeric"
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/\$\s?|(,*)/g, '')}
                        />
                      </Form.Item>
                      {fields.length > 1 && (
                        <MinusCircleOutlined
                          onClick={() => remove(name)}
                          style={{
                            color: '#ff4d4f',
                            fontSize: isMobileLayout ? '20px' : '16px',
                            minHeight: isMobileLayout ? '44px' : 'auto',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        />
                      )}
                    </Space>
                  ))}
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<PlusOutlined />}
                      style={{
                        marginTop: 8,
                        minHeight: isMobileLayout ? '44px' : 'auto'
                      }}
                      size={isMobileLayout ? 'large' : 'middle'}
                    >
                      Add Space Value
                    </Button>
                    <Form.ErrorList errors={errors} />
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="ratePerSqft"
            label={<span style={{ color: 'var(--text-secondary)' }}>Rate per sq ft (₹) <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.ratePerSqft}
          >
            <InputNumber
              placeholder="Enter rate per sq ft"
              size={isMobileLayout ? 'large' : 'middle'}
              inputMode="numeric"
              style={{ width: '100%' }}
              min={0}
              formatter={value => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/₹\s?|(,*)/g, '')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="offeredSpaceSqft"
            label={<span style={{ color: 'var(--text-secondary)' }}>Offered Space (sq ft)</span>}
          >
            <InputNumber
              placeholder="Enter offered space"
              size={isMobileLayout ? 'large' : 'middle'}
              inputMode="numeric"
              style={{ width: '100%' }}
              min={0}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="numberOfDocks"
            label={<span style={{ color: 'var(--text-secondary)' }}>Number of Docks</span>}
          >
            <InputNumber
              placeholder="Enter number of docks"
              size={isMobileLayout ? 'large' : 'middle'}
              inputMode="numeric"
              style={{ width: '100%' }}
              min={0}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="clearHeightFt"
            label={<span style={{ color: 'var(--text-secondary)' }}>Clear Height (ft)</span>}
          >
            <InputNumber
              placeholder="Enter clear height in feet"
              size={isMobileLayout ? 'large' : 'middle'}
              inputMode="numeric"
              style={{ width: '100%' }}
              min={0}
              step={0.1}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="availability"
            label={<span style={{ color: 'var(--text-secondary)' }}>Availability</span>}
          >
            <Select
              placeholder="Select availability"
              size={isMobileLayout ? 'large' : 'middle'}
            >
              <Option value="Available">Available</Option>
              <Option value="Occupied">Occupied</Option>
              <Option value="Under Maintenance">Under Maintenance</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="isBroker"
            label={<span style={{ color: 'var(--text-secondary)' }}>Is Broker</span>}
          >
            <Select
              placeholder="Select broker status"
              size={isMobileLayout ? 'large' : 'middle'}
            >
              <Option value="Yes">Yes</Option>
              <Option value="No">No</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="uploadedBy"
            label={<span style={{ color: 'var(--text-secondary)' }}>Uploaded By <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.uploadedBy}
          >
            <Input
              placeholder="Enter uploader name"
              size={isMobileLayout ? 'large' : 'middle'}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="visibility"
            label={<span style={{ color: 'var(--text-secondary)' }}>Visibility</span>}
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Visible"
              unCheckedChildren="Hidden"
              defaultChecked={true}
              size={isMobileLayout ? 'default' : 'default'}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="compliances"
            label={<span style={{ color: 'var(--text-secondary)' }}>Compliances <span style={{ color: '#ff4d4f' }}>*</span></span>}
            rules={validationRules.compliances}
          >
            <Input
              placeholder="Enter compliance details"
              size={isMobileLayout ? 'large' : 'middle'}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="otherSpecifications"
            label={<span style={{ color: 'var(--text-secondary)' }}>Other Specifications</span>}
          >
            <TextArea
              placeholder="Enter other specifications"
              rows={isMobileLayout ? 3 : 2}
              size={isMobileLayout ? 'large' : 'middle'}
            />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const renderLocationData = (isMobileLayout) => (
    <>
      {!isMobileLayout && (
        <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
          Location Data
        </Title>
      )}

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="latitude"
            label={<span style={{ color: 'var(--text-secondary)' }}>Latitude</span>}
            rules={[validationRules.coordinates.latitude]}
          >
            <InputNumber
              placeholder="Enter latitude (-90 to 90)"
              style={{ width: '100%' }}
              size={isMobileLayout ? 'large' : 'middle'}
              step={0.000001}
              precision={6}
              inputMode="decimal"
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="longitude"
            label={<span style={{ color: 'var(--text-secondary)' }}>Longitude</span>}
            rules={[validationRules.coordinates.longitude]}
          >
            <InputNumber
              placeholder="Enter longitude (-180 to 180)"
              style={{ width: '100%' }}
              size={isMobileLayout ? 'large' : 'middle'}
              step={0.000001}
              precision={6}
              inputMode="decimal"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="fireNocAvailable"
            label={<span style={{ color: 'var(--text-secondary)' }}>Fire NOC Available</span>}
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Yes"
              unCheckedChildren="No"
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="fireSafetyMeasures"
            label={<span style={{ color: 'var(--text-secondary)' }}>Fire Safety Measures</span>}
          >
            <Input
              placeholder="Enter fire safety measures"
              size={isMobileLayout ? 'large' : 'middle'}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="landType"
            label={<span style={{ color: 'var(--text-secondary)' }}>Land Type</span>}
          >
            <Select
              placeholder="Select land type"
              size={isMobileLayout ? 'large' : 'middle'}
            >
              <Option value="Commercial">Commercial</Option>
              <Option value="Industrial">Industrial</Option>
              <Option value="Others">Others</Option>
            </Select>
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="approachRoadWidth"
            label={<span style={{ color: 'var(--text-secondary)' }}>Approach Road Width (ft)</span>}
          >
            <InputNumber
              placeholder="Enter road width"
              style={{ width: '100%' }}
              size={isMobileLayout ? 'large' : 'middle'}
              min={1}
              inputMode="numeric"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="powerKva"
            label={<span style={{ color: 'var(--text-secondary)' }}>Power (KVA)</span>}
          >
            <InputNumber
              placeholder="Enter power in KVA"
              style={{ width: '100%' }}
              size={isMobileLayout ? 'large' : 'middle'}
              min={1}
              inputMode="numeric"
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="pollutionZone"
            label={<span style={{ color: 'var(--text-secondary)' }}>Pollution Zone</span>}
          >
            <Select
              placeholder="Select pollution zone"
              size={isMobileLayout ? 'large' : 'middle'}
            >
              <Option value="Green">Green</Option>
              <Option value="Orange">Orange</Option>
              <Option value="Red">Red</Option>
              <Option value="White">White</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="vaastuCompliance"
            label={<span style={{ color: 'var(--text-secondary)' }}>Vaastu Compliance</span>}
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Yes"
              unCheckedChildren="No"
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={isMobileLayout ? 24 : 12}>
          <Form.Item
            name="dimensions"
            label={<span style={{ color: 'var(--text-secondary)' }}>Dimensions</span>}
          >
            <Input
              placeholder="Enter warehouse dimensions"
              size={isMobileLayout ? 'large' : 'middle'}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24}>
          <Form.Item
            name="parkingDockingSpace"
            label={<span style={{ color: 'var(--text-secondary)' }}>Parking & Docking Space</span>}
          >
            <TextArea
              placeholder="Enter parking and docking space details"
              rows={isMobileLayout ? 3 : 2}
              size={isMobileLayout ? 'large' : 'middle'}
            />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const renderPhotoUpload = (isMobileLayout) => (
    <>
      {!isMobileLayout && (
        <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
          Warehouse Photos
        </Title>
      )}

      <Row gutter={isMobileLayout ? [0, 16] : 16}>
        <Col xs={24}>
          <Form.Item
            name="photos"
            label={<span style={{ color: 'var(--text-secondary)' }}>Upload Image</span>}
          >
            <FileUpload />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  // Handle input focus for better mobile UX
  const handleInputFocus = (fieldName) => {
    setFocusedField(fieldName);
    // On mobile, scroll the focused field into view
    if (isMobile) {
      setTimeout(() => {
        const element = document.querySelector(`[data-field="${fieldName}"]`);
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 100);
    }
  };

  const handleInputBlur = () => {
    setFocusedField(null);
  };

  // Enhanced input props for mobile optimization
  const getInputProps = (fieldName, inputMode = 'text', type = 'text') => ({
    size: isMobile ? 'large' : 'middle',
    onFocus: () => handleInputFocus(fieldName),
    onBlur: handleInputBlur,
    'data-field': fieldName,
    inputMode,
    type,
    autoComplete: getAutoCompleteValue(fieldName),
    style: {
      fontSize: isMobile ? '16px' : '14px' // Prevent zoom on iOS
    }
  });

  // Auto-complete values for better mobile experience
  const getAutoCompleteValue = (fieldName) => {
    const autoCompleteMap = {
      address: 'street-address',
      city: 'address-level2',
      state: 'address-level1',
      postalCode: 'postal-code',
      contactPerson: 'name',
      contactNumber: 'tel',
      googleLocation: 'url'
    };
    return autoCompleteMap[fieldName] || 'off';
  };

  const handleCancel = () => {
    form.resetFields();
    clearErrors(); // Clear any existing error messages
    onCancel();
  };
  const validationRules = {
    required: { required: true, message: 'This field is required' },
    email: { type: 'email', message: 'Please enter a valid email' },
    phone: {
      pattern: /^[+]?[0-9\s\-()]{10,15}$/,
      message: 'Please enter a valid phone number (10-15 digits, may include country code)'
    },
    number: {
      type: 'number',
      min: 0,
      message: 'Please enter a valid positive number'
    },
    coordinates: {
      latitude: {
        type: 'number',
        min: -90,
        max: 90,
        message: 'Latitude must be between -90 and 90'
      },
      longitude: {
        type: 'number',
        min: -180,
        max: 180,
        message: 'Longitude must be between -180 and 180'
      }
    },
    // Enhanced validation for warehouse-specific fields
    warehouseType: [
      { required: true, message: 'Warehouse type is required' },
      { min: 2, message: 'Warehouse type must be at least 2 characters' }
    ],
    address: [
      { required: true, message: 'Address is required' },
      { min: 10, message: 'Please provide a complete address (minimum 10 characters)' }
    ],
    city: [
      { required: true, message: 'City is required' },
      { min: 2, message: 'City name must be at least 2 characters' }
    ],
    state: [
      { required: true, message: 'State is required' },
      { min: 2, message: 'State name must be at least 2 characters' }
    ],
    contactPerson: [
      { required: true, message: 'Contact person name is required' },
      { min: 2, message: 'Contact person name must be at least 2 characters' }
    ],
    ratePerSqft: [
      { required: true, message: 'Rate per sq ft is required' }
    ],
    uploadedBy: [
      { required: true, message: 'Uploaded by field is required' },
      { min: 2, message: 'Uploader name must be at least 2 characters' }
    ],
    compliances: [
      { required: true, message: 'Compliance information is required' }
    ]
  };

  if (!visible) return null;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={handleCancel}
      title={initialData ? 'Edit Warehouse' : 'Create New Warehouse'}
      maxWidth="900px"
      className="warehouse-form-modal"
    >
      <Spin
        spinning={loading || submitting}
        tip={
          <div style={{
            color: 'var(--text-primary)',
            fontSize: isMobile ? '16px' : '14px',
            marginTop: '8px'
          }}>
            {submitting ? "Saving warehouse..." : "Loading..."}
          </div>
        }
        size={isMobile ? 'large' : 'default'}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onFinishFailed={(errorInfo) => {
            // On mobile, scroll to first error field
            if (isMobile && errorInfo.errorFields && errorInfo.errorFields.length > 0) {
              setTimeout(() => {
                const firstErrorField = errorInfo.errorFields[0]?.name[0];
                if (firstErrorField) {
                  const element = document.querySelector(`[data-field="${firstErrorField}"]`);
                  if (element) {
                    element.scrollIntoView({
                      behavior: 'smooth',
                      block: 'center',
                      inline: 'nearest'
                    });
                    element.focus();
                  }
                }
              }, 100);
            }
          }}
          requiredMark={false}
          style={{ color: 'var(--text-primary)' }}
          scrollToFirstError={!isMobile} // Use custom scroll behavior on mobile
        >
          {isMobile ? (
            // Mobile layout with collapsible sections
            <Collapse
              defaultActiveKey={['basic']}
              ghost
              style={{
                background: 'transparent',
                border: 'none'
              }}
            >
              <Panel
                header={
                  <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Basic Information
                  </Title>
                }
                key="basic"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}
              >
                {renderBasicInformation(true)}
              </Panel>

              <Panel
                header={
                  <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Contact Information
                  </Title>
                }
                key="contact"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}
              >
                {renderContactInformation(true)}
              </Panel>

              <Panel
                header={
                  <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Warehouse Details
                  </Title>
                }
                key="details"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}
              >
                {renderWarehouseDetails(true)}
              </Panel>

              <Panel
                header={
                  <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Location Data
                  </Title>
                }
                key="location"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}
              >
                {renderLocationData(true)}
              </Panel>

              <Panel
                header={
                  <Title level={5} style={{ color: 'var(--text-primary)', margin: 0 }}>
                    Warehouse Photos
                  </Title>
                }
                key="photos"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}
              >
                {renderPhotoUpload(true)}
              </Panel>
            </Collapse>
          ) : (
            // Desktop layout with sections
            <>
              {renderBasicInformation(false)}
              {renderContactInformation(false)}
              {renderWarehouseDetails(false)}
              {renderLocationData(false)}
              {renderPhotoUpload(false)}
            </>
          )}

          {/* Form Actions */}
          <div
            className={isMobile ? 'warehouse-form-actions' : ''}
            style={{
              marginTop: '32px',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: isMobile ? '12px' : '12px',
              position: isMobile ? 'sticky' : 'static',
              bottom: isMobile ? '0' : 'auto',
              background: isMobile ? 'var(--bg-secondary)' : 'transparent',
              padding: isMobile ? '16px 0' : '0',
              borderTop: isMobile ? '1px solid var(--border-primary)' : 'none'
            }}
          >
            <Button
              size="large"
              onClick={handleCancel}
              style={{
                minWidth: '120px',
                minHeight: isMobile ? '44px' : 'auto',
                order: isMobile ? 2 : 1,
                flex: isMobile ? '1' : 'none'
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={submitting ? null : <SaveOutlined />}
              loading={submitting}
              disabled={loading}
              style={{
                minWidth: '120px',
                minHeight: isMobile ? '44px' : 'auto',
                order: isMobile ? 1 : 2,
                flex: isMobile ? '1' : 'none'
              }}
            >
              {submitting
                ? (isMobile ? 'Saving...' : 'Saving')
                : `${initialData ? 'Update' : 'Create'} Warehouse`
              }
            </Button>
          </div>
        </Form>
      </Spin>
    </ResponsiveModal>
  );
};

export default WarehouseForm;
