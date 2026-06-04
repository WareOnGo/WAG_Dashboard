import { useCallback, useEffect, useState } from 'react';
import {
  Alert, App, Button, Card, Input, Result, Segmented, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CheckOutlined, ClockCircleOutlined, CloseCircleOutlined, CloseOutlined,
  DeleteOutlined, EyeOutlined, FilterOutlined, ReloadOutlined, SearchOutlined, ShopOutlined,
  UndoOutlined, UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts';
import { useViewport } from '../hooks';
import { warehouseService } from '../services/warehouseService';
import useWarehouseFilters from '../hooks/useWarehouseFilters';
import WarehouseForm from './WarehouseForm';
import WarehouseDetailsModal from './WarehouseDetailsModal';
import WarehouseFilterBar from './WarehouseFilterBar';
import CardView from './CardView';

const { Title } = Typography;

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
const STATUS_COLOR = { PENDING: 'gold', APPROVED: 'green', REJECTED: 'red' };

// Friendly labels + colors for the submission source.
const SOURCE_LABEL = { SCOUT: 'Scout Form', DASHBOARD: 'Dashboard', PARTNER_API: 'External' };
const SOURCE_COLOR = { SCOUT: 'geekblue', DASHBOARD: 'purple', PARTNER_API: 'cyan' };
const sourceLabel = (s) => SOURCE_LABEL[s] || s || 'External';

// Flattened WarehouseData columns on a staged row → re-nested for WarehouseForm.
const WD_KEYS = [
  'latitude', 'longitude', 'fireNocAvailable', 'fireSafetyMeasures', 'landType',
  'approachRoadWidth', 'dimensions', 'parkingDockingSpace', 'pollutionZone',
  'powerKva', 'vaastuCompliance',
];

/** Map a flat staged row into the shape WarehouseForm expects (nested warehouseData). */
function toFormInitialData(row) {
  const warehouseData = {};
  for (const key of WD_KEYS) warehouseData[key] = row[key];
  return { ...row, warehouseData };
}

/**
 * Admin review queue for staged warehouse submissions. Mirrors the dashboard exactly:
 * same Card container + CardView grid + WarehouseFilterBar. Each card has a single
 * "Review" button that opens the WarehouseForm edit modal, where Accept/Reject live in
 * the (sticky) footer. See docs/STAGING_VALIDATION_LAYER.md.
 */
const ReviewQueue = () => {
  const { user } = useAuth();
  const { isMobile } = useViewport();
  const { message, modal } = App.useApp();

  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null); // PENDING → editable form modal
  const [viewingRow, setViewingRow] = useState(null); // APPROVED/REJECTED → read-only modal
  const [acting, setActing] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const filters = useWarehouseFilters(rows);
  const isAdmin = !!user?.isAdmin;

  // Pending rows open the editable form; finalized rows open the read-only details modal.
  const openRow = (row) => {
    if (row.reviewStatus === 'PENDING') setEditingRow(row);
    else setViewingRow(row);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = status === 'ALL' ? {} : { reviewStatus: status };
      const data = await warehouseService.listStaged(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      message.error(err.message || 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [status, message]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const handleEditSubmit = async (payload) => {
    try {
      await warehouseService.updateStaged(editingRow.id, payload);
      message.success('Changes saved');
      setEditingRow(null);
      load();
    } catch (err) {
      message.error(err.message || 'Failed to save edits');
    }
  };

  const approve = (row) => {
    modal.confirm({
      title: 'Approve & publish this warehouse?',
      content: 'It will be added to the master list and made visible to users.',
      okText: 'Approve',
      onOk: async () => {
        setActing(true);
        try {
          const wh = await warehouseService.approveStaged(row.id);
          message.success(`Approved — warehouse #${wh.id} published`);
          setEditingRow(null);
          load();
        } catch (err) {
          const issues = err.response?.data?.details?.issues || [];
          if (issues.length) {
            modal.error({
              title: 'Cannot approve — validation failed',
              content: (
                <div>
                  <p>Edit the submission to fix these fields, then approve:</p>
                  <ul>
                    {issues.map((i, idx) => (
                      <li key={idx}>{(i.path || []).join('.') || '(field)'}: {i.message}</li>
                    ))}
                  </ul>
                </div>
              ),
            });
            load();
          } else {
            message.error(err.message || 'Failed to approve');
          }
        } finally {
          setActing(false);
        }
      },
    });
  };

  const reject = (row) => {
    let reason = '';
    modal.confirm({
      title: 'Reject this submission?',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="Reason for rejection (required)"
          onChange={(e) => { reason = e.target.value; }}
          style={{ marginTop: 8 }}
        />
      ),
      okText: 'Reject',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!reason.trim()) {
          message.error('A rejection reason is required');
          return Promise.reject(new Error('reason required'));
        }
        setActing(true);
        try {
          await warehouseService.rejectStaged(row.id, reason.trim());
          message.success('Submission rejected');
          setEditingRow(null);
          load();
        } catch (err) {
          message.error(err.message || 'Failed to reject');
        } finally {
          setActing(false);
        }
      },
    });
  };

  const reopen = (row) => {
    const isApproved = row.reviewStatus === 'APPROVED';
    modal.confirm({
      title: isApproved ? 'Revoke approval & move to Pending?' : 'Move submission back to Pending?',
      content: isApproved
        ? 'This removes the published warehouse from the master list and returns the submission to the queue.'
        : 'This returns the submission to the pending queue so it can be edited and re-reviewed.',
      okText: isApproved ? 'Revoke' : 'Move to Pending',
      okButtonProps: isApproved ? { danger: true } : undefined,
      onOk: async () => {
        setActing(true);
        try {
          await warehouseService.reopenStaged(row.id);
          message.success(isApproved ? 'Approval revoked — moved to Pending' : 'Moved back to Pending');
          setEditingRow(null);
          setViewingRow(null);
          load();
        } catch (err) {
          message.error(err.message || 'Failed to move to pending');
        } finally {
          setActing(false);
        }
      },
    });
  };

  const deleteRow = (row) => {
    const isApproved = row.reviewStatus === 'APPROVED';
    modal.confirm({
      title: 'Delete this submission?',
      content: isApproved
        ? `This removes the staging record. The published warehouse #${row.warehouseId} stays in the master list.`
        : 'This permanently removes the submission from the review queue.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActing(true);
        try {
          await warehouseService.deleteStaged(row.id);
          message.success('Submission deleted');
          setEditingRow(null);
          setViewingRow(null);
          load();
        } catch (err) {
          message.error(err.message || 'Failed to delete');
        } finally {
          setActing(false);
        }
      },
    });
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleString() : '—');

  // Provenance strip shown on each card (source, who submitted / approved / rejected + reason).
  const metaInfoFor = (row) => {
    const muted = 'rgba(255,255,255,0.5)';
    const strong = 'rgba(255,255,255,0.8)';
    const line = { display: 'flex', alignItems: 'center', gap: 6 };

    // Source tag + submitter, then a muted timestamp — the common header for every status.
    const header = (
      <>
        <div style={{ ...line, flexWrap: 'wrap', marginBottom: 4 }}>
          <Tag color={SOURCE_COLOR[row.source]} style={{ margin: 0 }}>{sourceLabel(row.source)}</Tag>
          <span style={{ color: strong }}><UserOutlined style={{ marginRight: 4 }} />{row.submittedBy}</span>
        </div>
        <div style={{ ...line, color: muted }}>
          <ClockCircleOutlined /> Submitted {fmtDate(row.submittedAt)}
        </div>
      </>
    );

    if (row.reviewStatus === 'APPROVED') {
      return (
        <>
          {header}
          <div style={{ ...line, color: '#52c41a', marginTop: 6 }}>
            <CheckCircleOutlined /> Approved by {row.reviewedBy || '—'} · {fmtDate(row.reviewedAt)}
          </div>
          {row.warehouseId && (
            <div style={{ ...line, color: muted }}><ShopOutlined /> Published as warehouse #{row.warehouseId}</div>
          )}
        </>
      );
    }
    if (row.reviewStatus === 'REJECTED') {
      return (
        <>
          {header}
          <div style={{ ...line, color: '#ff4d4f', marginTop: 6 }}>
            <CloseCircleOutlined /> Rejected by {row.reviewedBy || '—'} · {fmtDate(row.reviewedAt)}
          </div>
          {row.rejectionReason && (
            <div style={{ color: strong, marginTop: 2 }}>Reason: {row.rejectionReason}</div>
          )}
        </>
      );
    }
    return header;
  };

  // Single "Review" button per card (matches the dashboard's View/Edit button style).
  const getCardProps = (row) => ({
    idLabel: sourceLabel(row.source),
    statusContent: <Tag color={STATUS_COLOR[row.reviewStatus]} style={{ margin: 0 }}>{row.reviewStatus}</Tag>,
    metaInfo: metaInfoFor(row),
    actions: (
      <button className="simple-warehouse-card__action-btn" onClick={(e) => { e.stopPropagation(); openRow(row); }}>
        <EyeOutlined /> Review
      </button>
    ),
  });

  // Full provenance banner at the top of the read-only view modal.
  const viewStatusBanner = viewingRow ? (
    viewingRow.reviewStatus === 'APPROVED' ? (
      <Alert
        type="success"
        showIcon
        message={`Approved by ${viewingRow.reviewedBy || '—'}`}
        description={
          <span>
            On {fmtDate(viewingRow.reviewedAt)}
            {viewingRow.warehouseId ? ` · published as warehouse #${viewingRow.warehouseId}` : ''}.
            <br />Source: {sourceLabel(viewingRow.source)} · submitted by {viewingRow.submittedBy} on {fmtDate(viewingRow.submittedAt)}.
          </span>
        }
      />
    ) : (
      <Alert
        type="error"
        showIcon
        message={`Rejected by ${viewingRow.reviewedBy || '—'}`}
        description={
          <span>
            On {fmtDate(viewingRow.reviewedAt)}.
            {viewingRow.rejectionReason ? <><br /><strong>Reason:</strong> {viewingRow.rejectionReason}</> : null}
            <br />Source: {sourceLabel(viewingRow.source)} · submitted by {viewingRow.submittedBy} on {fmtDate(viewingRow.submittedAt)}.
          </span>
        }
      />
    )
  ) : null;

  // Shared footer-button style so review actions match the modal's own Cancel/Update/Close
  // buttons (same large size, same min width) and line up consistently across both modals.
  const btnStyle = { minWidth: 120, minHeight: isMobile ? 44 : 'auto' };

  // Edit modal (PENDING): Accept (primary) + destructive Reject / Delete (outlined danger).
  const editFooterActions = editingRow ? (
    <>
      <Button size="large" type="primary" icon={<CheckOutlined />} loading={acting}
        onClick={() => approve(editingRow)} style={btnStyle}>Accept</Button>
      <Button size="large" danger icon={<CloseOutlined />} loading={acting}
        onClick={() => reject(editingRow)} style={btnStyle}>Reject</Button>
      <Button size="large" danger icon={<DeleteOutlined />} loading={acting}
        onClick={() => deleteRow(editingRow)} style={btnStyle}>Delete</Button>
    </>
  ) : null;

  // View modal (APPROVED/REJECTED): the move-to-pending action (primary) + destructive Delete.
  const viewFooterActions = viewingRow ? (
    <>
      <Button size="large" type="primary" icon={<UndoOutlined />} loading={acting}
        onClick={() => reopen(viewingRow)} style={btnStyle}>
        {viewingRow.reviewStatus === 'APPROVED' ? 'Revoke approval' : 'Move to Pending'}
      </Button>
      <Button size="large" danger icon={<DeleteOutlined />} loading={acting}
        onClick={() => deleteRow(viewingRow)} style={btnStyle}>Delete</Button>
    </>
  ) : null;

  if (!isAdmin) {
    return (
      <Result status="403" title="Admins only" subTitle="The review queue is restricted to administrators." />
    );
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>Submission Review Queue</Title>

      <Card
        style={{
          background: isMobile ? 'rgba(31, 31, 31, 0.85)' : 'rgba(31, 31, 31, 0.6)',
          backdropFilter: isMobile ? 'none' : 'blur(20px)',
          WebkitBackdropFilter: isMobile ? 'none' : 'blur(20px)',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
        }}
        bodyStyle={isMobile ? { padding: '12px' } : undefined}
      >
        {/* Status tabs */}
        <Segmented
          block={isMobile}
          options={STATUS_TABS}
          value={status}
          onChange={setStatus}
          style={{ marginBottom: 16 }}
        />

        {/* One cohesive toolbar: search · filters · count · refresh */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            placeholder="Search submissions..."
            prefix={<SearchOutlined />}
            value={filters.searchText}
            onChange={(e) => filters.setSearchText(e.target.value)}
            allowClear
            style={{ flex: 1, minWidth: 220, maxWidth: 360 }}
          />
          <Button
            icon={<FilterOutlined />}
            onClick={() => setFiltersVisible(!filtersVisible)}
            type={filtersVisible ? 'primary' : 'default'}
          >
            {isMobile ? '' : 'Filters'}
          </Button>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          </Tooltip>
          <div style={{ marginLeft: 'auto', color: 'rgba(255, 255, 255, 0.55)', fontSize: 13, whiteSpace: 'nowrap' }}>
            {filters.filtered.length} of {rows.length}
          </div>
        </div>

        {filtersVisible && !isMobile && <WarehouseFilterBar filters={filters} />}

        <div style={{ padding: isMobile ? '4px' : '16px' }}>
          <CardView
            warehouses={filters.filtered}
            loading={loading}
            onViewDetails={openRow}
            getCardProps={getCardProps}
          />
        </div>
      </Card>

      {/* PENDING → editable form modal (same as the dashboard edit flow); Accept/Reject in footer */}
      <WarehouseForm
        visible={!!editingRow}
        initialData={editingRow ? toFormInitialData(editingRow) : null}
        onCancel={() => setEditingRow(null)}
        onSubmit={handleEditSubmit}
        loading={acting}
        reviewActions={editFooterActions}
      />

      {/* APPROVED/REJECTED → read-only details modal; move-to-pending in footer */}
      <WarehouseDetailsModal
        visible={!!viewingRow}
        warehouse={viewingRow ? toFormInitialData(viewingRow) : null}
        onClose={() => setViewingRow(null)}
        statusBanner={viewStatusBanner}
        footerActions={viewFooterActions}
      />
    </div>
  );
};

export default ReviewQueue;
