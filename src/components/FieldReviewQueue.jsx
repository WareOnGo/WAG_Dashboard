import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Pagination, Segmented, Tag } from 'antd';
import { FlagOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useViewport } from '../hooks';
import { fieldReviewService } from '../services/fieldReviewService';
import CardView from './CardView';
import FieldReviewDialog from './fieldReview/FieldReviewDialog';
import './fieldReview/fieldReview.css';
const validId = value => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value || '') ? value : null;
export default function FieldReviewQueue() {
  const { user } = useAuth();
  // Identity/role changes discard loaded records and cancel the previous queue's
  // requests before rendering another person's data.
  return <ReviewQueueContent key={(user?.email || '') + ':' + !!user?.isAdmin} user={user} />;
}
function ReviewQueueContent({ user }) {
  const { isMobile } = useViewport();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState(user?.isAdmin ? 'verify' : 'current'),
    [page, setPage] = useState(1);
  const [search, setSearch] = useState(''),
    [city, setCity] = useState(''),
    [assignee, setAssignee] = useState('');
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
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timeout = setTimeout(() => {
      fieldReviewService.list({
        view,
        page,
        limit: 12,
        search,
        city,
        ...(assignee ? {
          assigneeId: assignee
        } : {})
      }, controller.signal).then(r => {
        if (!controller.signal.aborted) {
          setResult(r);
          if (page > 1 && r.pagination.totalPages < page) setPage(Math.max(1, r.pagination.totalPages));
        }
      }).catch(e => {
        if (!controller.signal.aborted) setError(e.message);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 150);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [view, page, search, city, assignee, revision]);
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
  return <div className="fr-page"><div className="fr-page-heading"><div><h1>{user?.isAdmin ? 'Flag Review Queue' : 'Flagged for review'}</h1>
  <p>{user?.isAdmin ? 'Verify employee responses and manage field reviews.' : 'Warehouse fields assigned to you for review.'}</p></div><Tag icon={<FlagOutlined />}>{user?.isAdmin ? 'Admin view' : 'Assigned to me'}</Tag></div>
  <Card><div className="fr-segments"><Segmented block={isMobile && !user?.isAdmin} value={view} options={labels.map(([value, label]) => ({
          value,
          label: (isMobile && !user?.isAdmin ? value === 'current' ? 'Current' : 'Previous' : label) + ' (' + (result.counts[value] ?? 0) + ')'
        }))} onChange={v => {
          setView(v);
          setPage(1);
        }} /></div>
   <div className="fr-toolbar"><Input aria-label="Search field reviews" prefix={<SearchOutlined />} placeholder="Search WHID, city or address" allowClear value={search} onChange={e => {
          setSearch(e.target.value);
          setPage(1);
        }} />
    <Input aria-label="Filter field reviews by city" placeholder="City" allowClear value={city} onChange={e => {
          setCity(e.target.value);
          setPage(1);
        }} />
    {user?.isAdmin && <select className="fr-input" aria-label="Filter by assignee" value={assignee} onChange={e => {
          setAssignee(e.target.value);
          setPage(1);
        }}>
     <option value="">All assignees</option>{result.assignees?.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select>}
    <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button></div>
   {error && <Alert role="alert" type="error" showIcon message={error} action={<Button onClick={refresh}>Retry</Button>} />}
   <p className="fr-help">{view === 'previous' ? 'Completed reviews retain comments, responses and admin decisions.' : 'Pending responses remain here until admin verification. Live warehouse values are unchanged until approval.'}</p>
   {!loading && !error && !rows.length ? <Empty description={view === 'previous' ? 'No completed reviews yet.' : 'No warehouses in this review queue.'} /> : <CardView warehouses={rows} loading={loading} paginated={false} getCardProps={cardProps} />}
   <div className="fr-pagination"><Pagination current={page} pageSize={12} total={result.pagination.total || 0} onChange={setPage} showSizeChanger={false} /></div>
  </Card>
  {reviewId && <FieldReviewDialog key={reviewId} reviewId={reviewId} open onClose={closeReview} onReviewIdChange={openReview} />}
 </div>;
}
