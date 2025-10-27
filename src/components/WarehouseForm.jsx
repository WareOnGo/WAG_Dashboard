import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Row,
  Col,
  Card,
  Typography,
  Space,
  Spin
} from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import FileUpload from './FileUpload';
import {
  handleOperationError,
  showSuccessMessage,
  clearErrors
} from '../utils/errorHandler';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const WarehouseForm = ({
  visible,
  onCancel,
  onSubmit,
  initialData = null,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

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
        // Reset form for create mode
        form.resetFields();
      }
    }
  }, [visible, initialData, form]);

  const handleSubmit = async (values) => {
    setSubmitting(true);

    try {
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
        offeredSpaceSqft: values.offeredSpaceSqft || null,
        numberOfDocks: values.numberOfDocks || null,
        clearHeightFt: values.clearHeightFt || null,
        compliances: values.compliances,
        otherSpecifications: values.otherSpecifications || null,
        ratePerSqft: values.ratePerSqft,
        availability: values.availability || null,
        uploadedBy: values.uploadedBy,
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

      console.log('Payload being sent:', payload);
      await onSubmit(payload);
      form.resetFields();
      // Success message will be shown by parent component
    } catch (error) {
      // Error handling will be done by parent component
      console.error('Form submission error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Validation issues:', error.issues);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    clearErrors(); // Clear any existing error messages
    onCancel();
  };

  // Form validation rules
  const validationRules = {
    required: { required: true, message: 'This field is required' },
    email: { type: 'email', message: 'Please enter a valid email' },
    phone: {
      pattern: /^[0-9]{10}$/,
      message: 'Please enter a valid 10-digit phone number'
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
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <Title
            level={3}
            style={{
              color: 'var(--text-primary)',
              margin: 0
            }}
          >
            {initialData ? 'Edit Warehouse' : 'Create New Warehouse'}
          </Title>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={handleCancel}
            style={{ color: 'var(--text-muted)' }}
          />
        </div>

        <Spin spinning={loading || submitting} tip={submitting ? "Saving..." : "Loading..."}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
            style={{ color: 'var(--text-primary)' }}
          >
            {/* Basic Information Section */}
            <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>
              Basic Information
            </Title>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="warehouseOwnerType"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Warehouse Owner Type</span>}
                >
                  <Select placeholder="Select owner type">
                    <Option value="Owner">Owner</Option>
                    <Option value="Tenant">Tenant</Option>
                    <Option value="Broker">Broker</Option>
                    <Option value="Agent">Agent</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="warehouseType"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Warehouse Type <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter warehouse type (e.g., Cold Storage, Dry Storage)" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="zone"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Zone <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Select placeholder="Select zone">
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
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="address"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Address <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <TextArea
                    placeholder="Enter complete address"
                    rows={2}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="city"
                  label={<span style={{ color: 'var(--text-secondary)' }}>City <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter city" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="state"
                  label={<span style={{ color: 'var(--text-secondary)' }}>State <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter state" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="postalCode"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Postal Code</span>}
                >
                  <Input placeholder="Enter postal code" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="googleLocation"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Google Location URL</span>}
                >
                  <Input placeholder="Enter Google Maps URL" />
                </Form.Item>
              </Col>
            </Row>

            {/* Contact Information */}
            <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
              Contact Information
            </Title>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="contactPerson"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Contact Person <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter contact person name" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="contactNumber"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Contact Number <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required, validationRules.phone]}
                >
                  <Input placeholder="Enter 10-digit phone number" />
                </Form.Item>
              </Col>
            </Row>

            {/* Warehouse Details */}
            <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
              Warehouse Details
            </Title>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
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
                                min={1}
                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={value => value.replace(/\$\s?|(,*)/g, '')}
                              />
                            </Form.Item>
                            {fields.length > 1 && (
                              <MinusCircleOutlined
                                onClick={() => remove(name)}
                                style={{ color: '#ff4d4f' }}
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
                            style={{ marginTop: 8 }}
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

              <Col xs={24} sm={12}>
                <Form.Item
                  name="ratePerSqft"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Rate per sq ft (₹) <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter rate per sq ft" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="offeredSpaceSqft"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Offered Space (sq ft)</span>}
                >
                  <Input placeholder="Enter offered space" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="numberOfDocks"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Number of Docks</span>}
                >
                  <Input placeholder="Enter number of docks" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="clearHeightFt"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Clear Height (ft)</span>}
                >
                  <Input placeholder="Enter clear height in feet" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="availability"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Availability</span>}
                >
                  <Select placeholder="Select availability">
                    <Option value="Available">Available</Option>
                    <Option value="Occupied">Occupied</Option>
                    <Option value="Under Maintenance">Under Maintenance</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="isBroker"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Is Broker</span>}
                >
                  <Select placeholder="Select broker status">
                    <Option value="Yes">Yes</Option>
                    <Option value="No">No</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="uploadedBy"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Uploaded By <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter uploader name" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="compliances"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Compliances <span style={{ color: '#ff4d4f' }}>*</span></span>}
                  rules={[validationRules.required]}
                >
                  <Input placeholder="Enter compliance details" />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="otherSpecifications"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Other Specifications</span>}
                >
                  <TextArea
                    placeholder="Enter other specifications"
                    rows={2}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Location Data */}
            <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
              Location Data
            </Title>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="latitude"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Latitude</span>}
                  rules={[validationRules.coordinates.latitude]}
                >
                  <InputNumber
                    placeholder="Enter latitude (-90 to 90)"
                    style={{ width: '100%' }}
                    step={0.000001}
                    precision={6}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="longitude"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Longitude</span>}
                  rules={[validationRules.coordinates.longitude]}
                >
                  <InputNumber
                    placeholder="Enter longitude (-180 to 180)"
                    style={{ width: '100%' }}
                    step={0.000001}
                    precision={6}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
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

              <Col xs={24} sm={12}>
                <Form.Item
                  name="fireSafetyMeasures"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Fire Safety Measures</span>}
                >
                  <Input placeholder="Enter fire safety measures" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="landType"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Land Type</span>}
                >
                  <Select placeholder="Select land type">
                    <Option value="Commercial">Commercial</Option>
                    <Option value="Industrial">Industrial</Option>
                    <Option value="Others">Others</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="approachRoadWidth"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Approach Road Width (ft)</span>}
                >
                  <InputNumber
                    placeholder="Enter road width"
                    style={{ width: '100%' }}
                    min={1}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="powerKva"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Power (KVA)</span>}
                >
                  <InputNumber
                    placeholder="Enter power in KVA"
                    style={{ width: '100%' }}
                    min={1}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  name="pollutionZone"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Pollution Zone</span>}
                >
                  <Select placeholder="Select pollution zone">
                    <Option value="Green">Green</Option>
                    <Option value="Orange">Orange</Option>
                    <Option value="Red">Red</Option>
                    <Option value="White">White</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
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

              <Col xs={24} sm={12}>
                <Form.Item
                  name="dimensions"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Dimensions</span>}
                >
                  <Input placeholder="Enter warehouse dimensions" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="parkingDockingSpace"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Parking & Docking Space</span>}
                >
                  <TextArea
                    placeholder="Enter parking and docking space details"
                    rows={2}
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Photo Upload */}
            <Title level={5} style={{ color: 'var(--text-primary)', marginTop: '24px', marginBottom: '16px' }}>
              Warehouse Photos
            </Title>

            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="photos"
                  label={<span style={{ color: 'var(--text-secondary)' }}>Upload Image</span>}
                >
                  <FileUpload />
                </Form.Item>
              </Col>
            </Row>

            {/* Form Actions */}
            <div style={{
              marginTop: '32px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <Button
                size="large"
                onClick={handleCancel}
                style={{ minWidth: '100px' }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<SaveOutlined />}
                loading={submitting}
                style={{ minWidth: '100px' }}
              >
                {initialData ? 'Update' : 'Create'} Warehouse
              </Button>
            </div>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default WarehouseForm;