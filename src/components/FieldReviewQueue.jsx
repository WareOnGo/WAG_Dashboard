import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Segmented, Select, Tag } from 'antd';
import { FilterOutlined, FlagOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useViewport } from '../hooks';
import { useWarehouseFilters } from '../hooks/useWarehouseFilters';
import { fieldReviewService } from '../services/fieldReviewService';
import { canManageFieldReviews, fieldReviewAccessKey } from '../utils/fieldReviewPermissions';
import { pasteAsOneLine } from '../utils/pasteLines';
import CardView from './CardView';
import ListingPagination from './ListingPagination';
import WarehouseFilterBar, { AppliedWarehouseFilters } from './WarehouseFilterBar';
import FieldReviewDialog from './fieldReview/FieldReviewDialog';
import AiQaStage from './fieldReview/AiQaStage';
import ReviewAdminFilter from './fieldReview/ReviewAdminFilter';
import { aiQaService } from '../services/aiQaService';
import './fieldReview/fieldReview.css';
const validId = value => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value || '') ? value : null;
const EMPTY_OPTIONS = [];
export default function FieldReviewQueue() {
  const { user } = useAuth();
  // Identity and access changes discard records and filter suggestions, and
  // cancel requests from the previous scope.
  return <ReviewQueueContent key={`${fieldReviewAccessKey(user)}:${!!user?.isAdmin}`} user={user} />;
}
function ReviewQueueContent({ user }) {
  const canReview = canManageFieldReviews(user);
  const { isMobile } = useViewport();
  const [params, setParams] = useSearchParams();
  const canUseAi = user?.isAdmin === true;
  const labels = canReview ? [...(canUseAi ? [['ai', 'AI flags']] : []), ['employee', 'Awaiting employee'], ['verify', 'To verify'], ['previous', 'Previously flagged'], ['all', 'All']] : [['current', 'Currently flagged'], ['previous', 'Previously flagged']];
  const requestedView = params.get('stage');
  const view = labels.some(([key]) => key === requestedView) ? requestedView : canReview ? 'verify' : 'current';
  const setView = stage => setParams(old => { const next = new URLSearchParams(old); next.set('stage', stage); next.delete('review'); return next; });
  const [page, setPage] = useState(1);
  const [aiCount, setAiCount] = useState(null);
  const updateAiCount = useCallback(count => setAiCount(count), []);
  const [pageSize, setPageSize] = useState(20);
  const [assignee, setAssignee] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [reviewers, setReviewers] = useState([]);
  const [reviewersLoading, setReviewersLoading] = useState(false);
  const [reviewersError, setReviewersError] = useState('');
  const isAiView = view === 'ai';
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
    if (!canUseAi) return;
    const controller = new AbortController();
    setAiCount(null);
    aiQaService.summary(controller.signal, reviewerEmail ? { reviewerEmail } : {}).then(summary => { if (!controller.signal.aborted) setAiCount(summary.pending_warehouses); })
      .catch(() => { if (!controller.signal.aborted) setAiCount(null); });
    return () => controller.abort();
  }, [canUseAi, revision, reviewerEmail]);
  useEffect(() => {
    if (!canReview || isAiView) return;
    const controller = new AbortController();
    setReviewers([]);
    setReviewersLoading(true);
    setReviewersError('');
    fieldReviewService.reviewers(assignee ? { assigneeId: assignee } : {}, controller.signal)
      .then(people => { if (!controller.signal.aborted) setReviewers(people); })
      .catch(e => { if (!controller.signal.aborted) setReviewersError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setReviewersLoading(false); });
    return () => controller.abort();
  }, [canReview, isAiView, assignee, revision]);
  useEffect(() => {
    setPage(1);
  }, [queryParams, view, assignee, reviewerEmail]);
  useEffect(() => {
    if (view === 'ai') { setLoading(false); return; }
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
        } : {}),
        ...(reviewerEmail ? { reviewerEmail } : {})
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
  }, [view, page, pageSize, queryParams, assignee, reviewerEmail, revision]);
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
  const rows = result.data.map(r => ({
    ...r.warehouse,
    id: r.warehouseId,
    _review: r,
    warehouseType: r.warehouse?.warehouseType || 'Deleted warehouse'
  }));
  const cardProps = warehouse => {
    const r = warehouse._review;
    return {
      statusContent: <Tag color={r.closedAt ? 'green' : r.awaitingCount ? 'purple' : 'orange'}>{r.closedAt ? 'Verified & closed' : r.awaitingCount ? 'Awaiting reviewer' : 'Needs response'}</Tag>,
      metaInfo: <div className="fr-stack">{canReview && <span>Assigned to <strong>{r.assignee?.name || 'Unavailable employee'}</strong></span>}
    <span>{r.activeCount} active fields · {r.awaitingCount} awaiting reviewer</span>
    {r.closedAt ? <span>{r.flags.filter(f => f.resolution === 'NO_CHANGE').length} verified no-change responses</span> : null}
    <small>{new Date(r.createdAt).toLocaleDateString('en-IN')}</small></div>,
      actions: <Button type={canReview ? 'primary' : 'default'} block onClick={() => openReview(r.id)}>{r.closedAt ? 'View history' : canReview ? 'Review flags' : r.awaitingCount === r.activeCount ? 'View progress' : 'Review fields'}</Button>
    };
  };
  const total = result.pagination.total || 0;
  const hasReviewFilters = !!(assignee || reviewerEmail);
  const adminLabel = view === 'previous' ? 'Closed by' : view === 'all' ? 'Admin / reviewer' : 'Flagged by';
  const reviewFilters = [
    ...(assignee ? [{ key: 'assignee', label: `Assigned to: ${result.assignees?.find(person => person.id === assignee)?.name || assignee}`, clear: () => setAssignee('') }] : []),
    ...(reviewerEmail ? [{ key: 'reviewer', label: `${adminLabel}: ${reviewerEmail}`, clear: () => setReviewerEmail('') }] : [])
  ];
  const clearAllFilters = () => {
    filters.clearFilters();
    setAssignee('');
    setReviewerEmail('');
  };
  const filterButton = <Button icon={<FilterOutlined />} aria-label="Filters" aria-expanded={filtersVisible}
    aria-controls="field-review-filters" onClick={() => setFiltersVisible(value => !value)}
    type={filtersVisible ? 'primary' : 'default'} size={isMobile ? 'small' : 'middle'}>Filters</Button>;
  const changePage = (nextPage, nextSize) => {
    setPage(nextSize === pageSize ? nextPage : 1);
    setPageSize(nextSize);
    if (isMobile) resultsRef.current?.scrollIntoView({ block: 'start' });
  };
  return <div className="fr-page fr-queue dashboard-page"><div className="fr-page-heading"><div><h1>{canReview ? 'Flag Review Queue' : 'Flagged for review'}</h1>
  <p>{canReview ? 'Verify employee responses and manage field reviews.' : 'Warehouse fields assigned to you for review.'}</p></div><Tag icon={<FlagOutlined />}>{canReview ? 'Reviewer view' : 'Assigned to me'}</Tag></div>
  <Card className="fr-queue-panel dashboard-panel"><div className="fr-segments"><Segmented block={isMobile && !canReview} value={view} options={labels.map(([value, label]) => ({
          value,
          label: value === 'ai' ? label + (aiCount === null ? '' : ` (${aiCount})`) : (isMobile && !canReview ? value === 'current' ? 'Current' : 'Previous' : label) + (isAiView ? '' : ' (' + (result.counts[value] ?? 0) + ')')
        }))} onChange={setView} /></div>
   {view === 'ai' && canUseAi ? <AiQaStage onCountChange={updateAiCount} reviewerEmail={reviewerEmail} onReviewerChange={setReviewerEmail} onClearFilters={clearAllFilters} /> : <>
   <div className="fr-queue-toolbar dashboard-toolbar">
    <div className="fr-queue-search dashboard-search-row">
     <Input aria-label="Search field reviews" prefix={<SearchOutlined />} placeholder="Search name, place, ID or phone, or paste IDs" allowClear value={searchText}
       onChange={e => setSearchText(e.target.value)} onPaste={e => pasteAsOneLine(e, searchText, setSearchText)} />
     {!isMobile && filterButton}
     {!isMobile && <span className="fr-queue-count" role="status">{loading ? 'Loading results…' : `${rows.length} of ${total} results`}</span>}
    </div>
    <div className="fr-queue-actions dashboard-actions-row">
     {isMobile && filterButton}
     <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading} size={isMobile ? 'small' : 'middle'}>Refresh</Button>
    </div>
   </div>
   {isMobile && <div className="fr-queue-count" role="status">{loading ? 'Loading results…' : `${rows.length} of ${total} results`}</div>}
   {canReview && <div className="fr-queue-review-filters" role="group" aria-label="Review filters">
    <div className="fr-queue-review-filter">
     <label htmlFor="review-assignee">Assigned to</label>
     <Select id="review-assignee" aria-label="Filter by assignee" placeholder="All assignees" allowClear showSearch optionFilterProp="label"
       value={assignee || undefined} onChange={value => setAssignee(value || '')}
       options={result.assignees?.map(person => ({ value: person.id, label: person.name }))} />
    </div>
    <ReviewAdminFilter label={adminLabel} value={reviewerEmail} onChange={setReviewerEmail} reviewers={reviewers} loading={reviewersLoading} />
   </div>}
   {reviewersError && <Alert role="alert" type="error" showIcon message={`Admin suggestions unavailable: ${reviewersError}`} action={<Button onClick={refresh}>Retry suggestions</Button>} />}
   <AppliedWarehouseFilters filters={filters} resultCount={total} loading={loading} additionalFilters={reviewFilters} onClear={clearAllFilters} />
   <div id="field-review-filters" hidden={!filtersVisible}>
    {filtersVisible && <WarehouseFilterBar filters={filters} optionRows={result.filterOptions || EMPTY_OPTIONS} additionalFilterCount={reviewFilters.length} onClear={clearAllFilters} />}
   </div>
   {error && <Alert role="alert" type="error" showIcon message={error} action={<Button onClick={refresh}>Retry</Button>} />}
   <p className="fr-help">{view === 'previous' ? 'Completed reviews retain comments, responses and reviewer decisions.' : 'Pending responses remain here until reviewer verification. Live warehouse values are unchanged until approval.'}
    {canReview && reviewerEmail ? view === 'previous' ? ' Showing reviews with fields verified or cancelled by this admin/reviewer.' : view === 'all' ? ' Showing any recorded flag, verification, return, reopen, cancellation or reassignment by this admin/reviewer.' : ' Showing active fields raised by this admin/reviewer in this stage.' : ''}</p>
   <div className="fr-queue-results dashboard-card-results" ref={resultsRef}>
    {!error && (!loading && !rows.length ? <Empty description={hasReviewFilters || Object.keys(queryParams).length ? 'No reviews match these filters.' : view === 'previous' ? 'No completed reviews yet.' : 'No warehouses in this review queue.'} /> : <CardView warehouses={rows} loading={loading} paginated={false} getCardProps={cardProps} />)}
    {(total > pageSize || (!isMobile && pageSize !== 20 && total > 0)) && <ListingPagination current={page} pageSize={pageSize} total={total} onChange={changePage} pageSizeOptions={[10, 20, 50, 100]} disabled={loading} />}
   </div>
   </>}
  </Card>
  {view !== 'ai' && reviewId && <FieldReviewDialog key={reviewId} reviewId={reviewId} open onClose={closeReview} onReviewIdChange={openReview} />}
 </div>;
}
