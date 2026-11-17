import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Segmented, Select, Tag } from 'antd';
import { FilterOutlined, FlagOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useViewport } from '../hooks';
import { useWarehouseFilters } from '../hooks/useWarehouseFilters';
import { fieldReviewService } from '../services/fieldReviewService';
import { warehouseAccessKey } from '../utils/warehousePermissions';
import { pasteAsOneLine } from '../utils/pasteLines';
import CardView from './CardView';
import ListingPagination from './ListingPagination';
import WarehouseFilterBar, { AppliedWarehouseFilters } from './WarehouseFilterBar';
import FieldReviewDialog from './fieldReview/FieldReviewDialog';
import './fieldReview/fieldReview.css';
const validId = value => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value || '') ? value : null;
const EMPTY_OPTIONS = [];
export default function FieldReviewQueue() {
  const { user } = useAuth();
  // Identity and access changes discard records and filter suggestions, and
  // cancel requests from the previous scope.
  return <ReviewQueueContent key={warehouseAccessKey(user)} user={user} />;
}
function ReviewQueueContent({ user }) {
  const { isMobile } = useViewport();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(user?.isAdmin ? 'verify' : 'current'),
    [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [assignee, setAssignee] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const filters = useWarehouseFilters();
  const { queryParams, searchText, setSearchText } = filters;
  const resultsRef = useRef(null);
  const [result, setResult] = useState({
      data: [],
      counts: {},
      pagination: {
        total: 0
      }
    }),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reviewId = validId(params.get('review'));
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    setPage(1);
  }, [queryParams, view, assignee]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => {
      fieldReviewService.list({
        view,
        page,
        limit: pageSize,
        ...queryParams,
        ...(assignee ? {
          assigneeId: assignee
        } : {})
      }, controller.signal).then(r => {
        if (!controller.signal.aborted) {
          setResult(r);
          if (page > 1 && r.pagination.totalPages < page) setPage(Math.max(1, r.pagination.totalPages));
        }
      }).catch(e => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setResult({ data: [], counts: {}, pagination: { total: 0 } });
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 150);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [view, page, pageSize, queryParams, assignee, revision]);
  useEffect(() => {
    window.addEventListener('warehouse-field-review-updated', refresh);
    return () => window.removeEventListener('warehouse-field-review-updated', refresh);
  }, [refresh]);
  const openReview = id => {
    setParams(old => {
      const p = new URLSearchParams(old);
      p.set('review', id);
      return p;
    });
  };
  const closeReview = () => {
    setParams(old => {
      const p = new URLSearchParams(old);
      p.delete('review');
      return p;
    });
  };
  const labels = user?.isAdmin ? [['employee', 'Awaiting employee'], ['verify', 'To verify'], ['previous', 'Previously flagged'], ['all', 'All']] : [['current', 'Currently flagged'], ['previous', 'Previously flagged']];
  const rows = result.data.map(r => ({
    ...r.warehouse,
    id: r.warehouseId,
    _review: r,
    warehouseType: r.warehouse?.warehouseType || 'Deleted warehouse'
  }));
  const cardProps = warehouse => {
    const r = warehouse._review;
    return {
      statusContent: <Tag color={r.closedAt ? 'green' : r.awaitingCount ? 'purple' : 'orange'}>{r.closedAt ? 'Verified & closed' : r.awaitingCount ? 'Awaiting admin' : 'Needs response'}</Tag>,
      metaInfo: <div className="fr-stack">{user?.isAdmin && <span>Assigned to <strong>{r.assignee?.name || 'Unavailable employee'}</strong></span>}
    <span>{r.activeCount} active fields · {r.awaitingCount} awaiting admin</span>
    {r.closedAt ? <span>{r.flags.filter(f => f.resolution === 'NO_CHANGE').length} verified no-change responses</span> : null}
    <small>{new Date(r.createdAt).toLocaleDateString('en-IN')}</small></div>,
      actions: <Button type={user?.isAdmin ? 'primary' : 'default'} block onClick={() => openReview(r.id)}>{r.closedAt ? 'View history' : user?.isAdmin ? 'Review flags' : r.awaitingCount === r.activeCount ? 'View progress' : 'Review fields'}</Button>
    };
  };
  const total = result.pagination.total || 0;
  const filterButton = <Button icon={<FilterOutlined />} aria-label="Filters" aria-expanded={filtersVisible}
    aria-controls="field-review-filters" onClick={() => setFiltersVisible(value => !value)}
    type={filtersVisible ? 'primary' : 'default'} size={isMobile ? 'small' : 'middle'}>Filters</Button>;
  const changePage = (nextPage, nextSize) => {
    setPage(nextSize === pageSize ? nextPage : 1);
    setPageSize(nextSize);
    if (isMobile) resultsRef.current?.scrollIntoView({ block: 'start' });
  };
  return <div className="fr-page fr-queue"><div className="fr-page-heading"><div><h1>{user?.isAdmin ? 'Flag Review Queue' : 'Flagged for review'}</h1>
  <p>{user?.isAdmin ? 'Verify employee responses and manage field reviews.' : 'Warehouse fields assigned to you for review.'}</p></div><Tag icon={<FlagOutlined />}>{user?.isAdmin ? 'Admin view' : 'Assigned to me'}</Tag></div>
  <Card className="fr-queue-panel"><div className="fr-segments"><Segmented block={isMobile && !user?.isAdmin} value={view} options={labels.map(([value, label]) => ({
          value,
          label: (isMobile && !user?.isAdmin ? value === 'current' ? 'Current' : 'Previous' : label) + ' (' + (result.counts[value] ?? 0) + ')'
        }))} onChange={setView} /></div>
   <div className="fr-queue-toolbar">
    <div className="fr-queue-search">
     <Input aria-label="Search field reviews" prefix={<SearchOutlined />} placeholder="Search name, place, ID or phone, or paste IDs" allowClear value={searchText}
       onChange={e => setSearchText(e.target.value)} onPaste={e => pasteAsOneLine(e, searchText, setSearchText)} />
     {!isMobile && filterButton}
     {!isMobile && <span className="fr-queue-count" role="status">{loading ? 'Loading results…' : `${rows.length} of ${total} results`}</span>}
    </div>
    <div className="fr-queue-actions">
     {isMobile && filterButton}
     {user?.isAdmin && <Select className="fr-queue-assignee" aria-label="Filter by assignee" placeholder="All assignees" allowClear
       value={assignee || undefined} onChange={value => setAssignee(value || '')}
       options={result.assignees?.map(person => ({ value: person.id, label: person.name }))} />}
     <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading} size={isMobile ? 'small' : 'middle'}>Refresh</Button>
    </div>
   </div>
   {isMobile && <div className="fr-queue-count" role="status">{loading ? 'Loading results…' : `${rows.length} of ${total} results`}</div>}
   <AppliedWarehouseFilters filters={filters} resultCount={total} loading={loading} />
   <div id="field-review-filters" hidden={!filtersVisible}>
    {filtersVisible && <WarehouseFilterBar filters={filters} optionRows={result.filterOptions || EMPTY_OPTIONS} />}
   </div>
   {error && <Alert role="alert" type="error" showIcon message={error} action={<Button onClick={refresh}>Retry</Button>} />}
   <p className="fr-help">{view === 'previous' ? 'Completed reviews retain comments, responses and admin decisions.' : 'Pending responses remain here until admin verification. Live warehouse values are unchanged until approval.'}</p>
   <div className="fr-queue-results" ref={resultsRef}>
    {!error && (!loading && !rows.length ? <Empty description={Object.keys(queryParams).length ? 'No reviews match these filters.' : view === 'previous' ? 'No completed reviews yet.' : 'No warehouses in this review queue.'} /> : <CardView warehouses={rows} loading={loading} paginated={false} getCardProps={cardProps} />)}
    {(total > pageSize || (!isMobile && pageSize !== 20 && total > 0)) && <ListingPagination current={page} pageSize={pageSize} total={total} onChange={changePage} pageSizeOptions={[10, 20, 50, 100]} disabled={loading} />}
   </div>
  </Card>
  {reviewId && <FieldReviewDialog key={reviewId} reviewId={reviewId} open onClose={closeReview} onReviewIdChange={openReview} />}
 </div>;
}
