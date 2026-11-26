import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Empty, Input, Select, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { aiQaService } from '../../services/aiQaService';
import { warehouseService } from '../../services/warehouseService';
import ResponsiveModal from '../ResponsiveModal';
import CardView from '../CardView';
import ListingPagination from '../ListingPagination';
import { useViewport } from '../../hooks/useViewport';
import { snapshotWarehouse } from './aiQaReviewDraft';
import { AI_QA_STAGES, aiQaStage } from './aiQaStages';
import AiQaReviewDialog from './AiQaReviewDialog';
import ReviewAdminFilter from './ReviewAdminFilter';
import './aiQa.css';

export default function AiQaStage({ onCountChange, reviewerEmail = '', onReviewerChange, onClearFilters }) {
  const { message } = App.useApp();
  const { isMobile } = useViewport();
  const resultsRef = useRef(null);
  const [pageSize, setPageSize] = useState(20);
  const [config, setConfig] = useState(null),
    [runs, setRuns] = useState([]),
    [runId, setRunId] = useState('');
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0),
    [whid, setWhid] = useState(null),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('AI_REVIEW');
  const [batchOpen, setBatchOpen] = useState(false),
    [ids, setIds] = useState(''),
    [job, setJob] = useState(null),
    [starting, setStarting] = useState(false);
  const [jobError, setJobError] = useState('');
  const [page, setPage] = useState(1),
    [searchTerm, setSearchTerm] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewers, setReviewers] = useState([]);
  const [reviewersLoading, setReviewersLoading] = useState(false);
  const [reviewersError, setReviewersError] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => { setPage(1); }, [reviewerEmail]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([aiQaService.config(controller.signal), aiQaService.runs(controller.signal)])
      .then(([c, saved]) => {
        if (controller.signal.aborted) return;
        setConfig(c);
        setRuns(saved);
        setRunId((current) => current || saved[0]?.id || '');
        setJob((current) => current || saved.find((run) => run.status === 'RUNNING') || null);
        if (!saved.length) setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
    };
  }, [revision]);
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    setReviewers([]);
    setReviewersLoading(true);
    setReviewersError('');
    aiQaService.reviewers(runId, controller.signal)
      .then(people => { if (!controller.signal.aborted) setReviewers(people); })
      .catch(e => { if (!controller.signal.aborted) setReviewersError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setReviewersLoading(false); });
    return () => controller.abort();
  }, [runId, revision]);
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    aiQaService
      .list(runId, controller.signal, { page, limit: pageSize, stage: status, search: searchTerm, ...(reviewerEmail ? { reviewerEmail } : {}) })
      .then(async (result) => {
        if (controller.signal.aborted) return;
        // Use the same bounded warehouse read as the dashboard/PPT picker so
        // cards and the details gallery receive the real media/variant metadata.
        const ids = [...new Set(result.warehouses.map((row) => row.warehouse_id))];
        let warehouses = [];
        if (ids.length) {
          try {
            warehouses = await warehouseService.getByIds(ids, { signal: controller.signal });
          } catch (error) {
            if (controller.signal.aborted) return;
            if ([401, 403].includes(error.response?.status || error.status)) throw error;
            // Saved evidence remains useful during a source/media outage.
          }
        }
        if (controller.signal.aborted) return;
        const warehouseById = Object.fromEntries(warehouses.map((warehouse) => [warehouse.id, warehouse]));
        const unavailableIds = ids.filter((id) => !warehouseById[id]);
        setData({ ...result, warehouseById, unavailableIds });
        if (page > Math.max(1, Math.ceil(result.total / pageSize)))
          setPage(Math.max(1, Math.ceil(result.total / pageSize)));
        aiQaService
          .summary(controller.signal, reviewerEmail ? { reviewerEmail } : {})
          .then((summary) => {
            if (!controller.signal.aborted) {
              onCountChange(summary.pending_warehouses);
              setRuns((current) =>
                current.map((run) =>
                  run.id === 'inbox'
                    ? { ...run, warehouse_count: summary.pending_reviews ?? summary.pending_warehouses }
                    : run
                )
              );
            }
          })
          .catch(() => {});
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [runId, revision, onCountChange, page, pageSize, status, searchTerm, reviewerEmail]);
  const jobId = job?.id;
  useEffect(() => {
    if (!jobId || jobError) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const result = await aiQaService.processRun(jobId, controller.signal);
        if (controller.signal.aborted) return;
        if (['COMPLETED', 'PARTIAL'].includes(result.status)) {
          const saved = await aiQaService.runs(controller.signal);
          if (controller.signal.aborted) return;
          setRuns(saved);
          setRunId('inbox');
          setPage(1);
          setJob(saved.find((run) => run.status === 'RUNNING') || null);
          setStatus('AI_REVIEW');
          refresh();
        } else if (result.status === 'FAILED') {
          setJob(null);
          setError(result.error || 'The QA batch failed.');
        } else {
          setJob(result);
          timer = setTimeout(poll, 2000);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setJobError(e.message);
          if ([401, 403].includes(e.status)) {
            setData(null);
            setWhid(null);
          }
        }
      }
    };
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, jobError, refresh]);

  async function startBatch() {
    if (!/^\s*\d+(?:[\s,]+\d+)*\s*$/.test(ids)) {
      message.error('Enter warehouse IDs separated by commas or spaces.');
      return;
    }
    const values = ids
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (new Set(values).size !== values.length || values.length > 100) {
      message.error('Use unique warehouse IDs, up to 100 per batch.');
      return;
    }
    setStarting(true);
    try {
      const result = await aiQaService.createRun(values);
      if (mounted.current) {
        if (result.skipped)
          message.info(
            `${result.skipped} listings were skipped because they are outside this QA policy's scope.`
          );
        setJob(result);
        setJobError('');
        setBatchOpen(false);
      }
    } catch (e) {
      if (mounted.current) message.error(e.message);
    } finally {
      if (mounted.current) setStarting(false);
    }
  }
  const run = runs.find((r) => r.id === runId);
  const adminLabel = ['ASSIGNED', 'ASSIGNED_LOCAL'].includes(status) ? 'Approved by'
    : status === 'DISMISSED' ? 'Dismissed by' : status === 'all' ? 'Admin / reviewer' : 'Reviewed by';
  const activeFilterCount = Number(!!search) + Number(!!reviewerEmail) + Number(!!runId && runId !== 'inbox');
  const clearAllFilters = () => {
    setSearch('');
    setSearchTerm('');
    onReviewerChange('');
    onClearFilters?.();
    setRunId('inbox');
    setPage(1);
  };
  const rows = data?.warehouses || [];
  const metrics = data?.metrics || {};
  const cardRows = rows.map((row) => ({
    ...snapshotWarehouse(row, data.warehouseById[row.warehouse_id]),
    _qaReview: row
  }));
  const cardProps = (warehouse) => {
    const review = warehouse._qaReview;
    const machine = review.candidates.filter((candidate) => candidate.source === 'MACHINE').length;
    const human = review.candidates.length - machine;
    const stage = aiQaStage(review.stage);
    return {
      contactContent: null,
      statusContent: <Tag color={stage.color}>{stage.label}</Tag>,
      metaInfo: (
        <div className="fr-stack aiq-card-meta">
          <span>
            {review.candidates.length} flagged fields · {review.checks.length} checks
          </span>
          <div className="aiq-tags">
            {!!machine && (
              <span className="aiq-source aiq-source--machine">
                {machine} AI {machine === 1 ? 'flag' : 'flags'}
              </span>
            )}
            {!!human && (
              <span className="aiq-source aiq-source--admin">
                {human} human {human === 1 ? 'flag' : 'flags'}
              </span>
            )}
          </div>
          {review.source_captured_at_utc && (
            <small>Snapshot: {new Date(review.source_captured_at_utc).toLocaleString('en-IN')}</small>
          )}
          {!data.warehouseById[review.warehouse_id] && <small>Source unavailable · saved review only</small>}
        </div>
      ),
      actions: (
        <Button
          type="primary"
          block
          aria-label={'Review AI flags for WH' + review.warehouse_id}
          onClick={() =>
            setWhid({
              id: review.warehouse_id,
              run: review.run_id || runId,
              warehouse: data.warehouseById[review.warehouse_id],
              sourceUnavailable: !data.warehouseById[review.warehouse_id]
            })
          }
        >
          {review.stage === 'AI_REVIEW' ? 'Review flags' : 'View review'}
        </Button>
      )
    };
  };
  function changePage(nextPage, nextSize) {
    setPage(nextSize === pageSize ? nextPage : 1);
    setPageSize(nextSize);
    if (isMobile) resultsRef.current?.scrollIntoView({ block: 'start' });
  }
  return (
    <section className="aiq-stage" aria-label="AI flags stage">
      {error && (
        <Alert
          showIcon
          role="alert"
          type="error"
          message={error}
          action={<Button onClick={runId ? refresh : () => window.location.reload()}>Retry</Button>}
        />
      )}
      {job && (
        <Alert
          showIcon
          type={jobError ? 'error' : 'info'}
          message={jobError ? 'QA progress could not be updated.' : 'Running warehouse QA…'}
          description={jobError || 'Progress is saved. Reopening this page resumes unfinished batches.'}
          action={jobError && <Button onClick={() => setJobError('')}>Resume QA</Button>}
        />
      )}
      {!!data?.unavailableIds?.length && (
        <Alert
          type="warning"
          showIcon
          message="Some source records or photos are unavailable. Their saved reviews remain visible; assignment is disabled for those records."
          action={<Button onClick={refresh}>Retry source</Button>}
        />
      )}
      {(run?.status === 'PARTIAL' ||
        rows.some(
          (row) => row.coverage?.ai_status === 'FAILED' || row.coverage?.ai_status === 'POLICY_CHANGED'
        )) && (
        <Alert
          showIcon
          type="warning"
          message="Some AI evaluations failed. Their checks remain not evaluated and need a retry."
        />
      )}
      <div className="fr-queue-toolbar">
        <div className="fr-queue-search">
          <Input
            aria-label="Search AI flags"
            prefix={<SearchOutlined />}
            placeholder="Search warehouse ID or city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            aria-label="AI review status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[...AI_QA_STAGES, { value: 'all', label: 'All stages' }]}
          />
        </div>
        <div className="fr-queue-actions">
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            Refresh
          </Button>
          <Button
            disabled={!config || !!job}
            onClick={() => {
              setIds([...new Set((data?.warehouses || []).map((r) => r.warehouse_id))].join(', '));
              setBatchOpen(true);
            }}
          >
            Run QA
          </Button>
          <Button type="text" onClick={() => setDetailsOpen(true)}>
            Review stats
          </Button>
        </div>
      </div>
      <div className="fr-queue-review-filters" role="group" aria-label="Review filters">
        <ReviewAdminFilter label={adminLabel} value={reviewerEmail} onChange={onReviewerChange} reviewers={reviewers} loading={reviewersLoading} />
        {!!activeFilterCount && <div className="applied-filters" aria-label="Applied filters">
          <span role="status">{activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}</span>
          <Button type="link" onClick={clearAllFilters}>Clear All Filters</Button>
        </div>}
      </div>
      {reviewersError && <Alert role="alert" type="error" showIcon message={`Admin suggestions unavailable: ${reviewersError}`} action={<Button onClick={refresh}>Retry suggestions</Button>} />}
      {reviewerEmail && <p className="fr-help">{['ASSIGNED', 'ASSIGNED_LOCAL', 'DISMISSED', 'STALE'].includes(status)
        ? 'Showing outcomes confirmed by this admin.'
        : 'Showing reviews with saved review actions by this admin. Automated flags have no admin until someone reviews them.'}</p>}
      {runId && runId !== 'inbox' && (
        <Tag
          closable
          onClose={() => {
            setRunId('inbox');
            setPage(1);
          }}
        >
          Batch: {new Date(run?.generated_at_utc).toLocaleString('en-IN')}
        </Tag>
      )}
      <div className="aiq-legend">
        <span>
          <i className="aiq-dot aiq-dot--machine" />
          AI flags
        </span>
        <span>
          <i className="aiq-dot aiq-dot--admin" />
          Human flags
        </span>
        <span>
          {data?.total ?? rows.length} reviews · {data?.flagged_columns ?? 0} flags
        </span>
      </div>
      <div className="fr-queue-results dashboard-card-results" ref={resultsRef}>
        {!error &&
          (!loading && !rows.length ? (
            <Empty description={activeFilterCount ? 'No AI reviews match these filters.' : 'No PEB warehouses in this AI review stage.'} />
          ) : (
            <CardView
              warehouses={cardRows}
              loading={loading}
              paginated={false}
              getCardProps={cardProps}
              getRowKey={(warehouse) => `${warehouse._qaReview.run_id}:${warehouse.id}`}
            />
          ))}
        {((data?.total || 0) > pageSize || (!isMobile && pageSize !== 20 && (data?.total || 0) > 0)) && (
          <ListingPagination
            current={page}
            pageSize={pageSize}
            total={data?.total || 0}
            onChange={changePage}
            pageSizeOptions={[10, 20, 50, 100]}
            disabled={loading}
          />
        )}
      </div>
      {detailsOpen && (
        <ResponsiveModal
          visible
          title="Review stats & history"
          onClose={() => setDetailsOpen(false)}
          maxWidth="760px"
          className="aiq-modal"
        >
          <label className="fr-label" htmlFor="aiq-run">
            QA batch
          </label>
          <Select
            id="aiq-run"
            className="aiq-run-select"
            aria-label="QA run"
            value={runId}
            onChange={(id) => {
              setRunId(id);
              setPage(1);
              setWhid(null);
              setData(null);
            }}
            options={runs.map((r) => ({
              value: r.id,
              label:
                r.id === 'inbox'
                  ? 'All batches'
                  : `${r.eligible_warehouse_count ?? r.warehouse_count} PEB warehouses · ${new Date(r.generated_at_utc).toLocaleString('en-IN')}`
            }))}
          />
          <p className="fr-help">
            Field decisions in the current view. Use All stages to include completed reviews.
          </p>
          <div className="aiq-metrics">
            {[
              ['Awaiting decision', metrics.pending],
              ['Approved', metrics.accepted],
              ['Incorrect flags', metrics.rejected_incorrect],
              ['Missed by AI', metrics.admin_found_misses],
              ['Not covered', metrics.coverage_gaps],
              ['Reviewed clean', metrics.reviewed_clean_columns]
            ].map(([label, count]) => (
              <div className="aiq-metric" key={label}>
                <span>{label}</span>
                <strong>{count ?? '—'}</strong>
              </div>
            ))}
          </div>
          <p className="fr-help">
            Only “Incorrect” rejections count as false positives. A miss must identify an evaluated check;
            uncovered issues are coverage gaps. Unreviewed fields do not count as clean.
          </p>
          <p className="fr-help">
            Model: {config?.model} · SOP {config?.profile?.policy_version} ·{' '}
            {config?.source === 'pilot' ? 'Imported snapshots' : 'Fresh warehouse snapshots'}. Assignments are{' '}
            {config?.handoff_mode === 'FIELD_REVIEW'
              ? 'sent to the employee review queue after approval.'
              : 'staged locally.'}
          </p>
        </ResponsiveModal>
      )}
      {whid && config && (
        <AiQaReviewDialog
          key={`${whid.run}:${whid.id}`}
          runId={whid.run}
          whid={whid.id}
          config={config}
          warehouse={whid.warehouse}
          sourceUnavailable={whid.sourceUnavailable}
          onClose={() => setWhid(null)}
          onSaved={refresh}
        />
      )}
      {batchOpen && (
        <ResponsiveModal
          visible
          title="Run warehouse QA"
          onClose={() => {
            if (!starting) setBatchOpen(false);
          }}
          closable={!starting}
          maskClosable={false}
          maxWidth="600px"
          className="fr-modal"
          footer={
            <div className="fr-row fr-end">
              <Button disabled={starting} onClick={() => setBatchOpen(false)}>
                Cancel
              </Button>
              <Button type="primary" loading={starting} onClick={startBatch}>
                Run QA
              </Button>
            </div>
          }
        >
          <p>
            Evaluate PEB warehouse snapshots using deterministic checks and gpt-6.2-sol. RCC, BTS, Shed and
            unknown types are skipped. New evaluations may use the configured OpenAI key; matching cached
            results are reused.
          </p>
          <label className="fr-label" htmlFor="aiq-batch-ids">
            Warehouse IDs
          </label>
          <Input.TextArea
            id="aiq-batch-ids"
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            autoSize={{ minRows: 3 }}
          />
          <p className="fr-help">
            {config?.source === 'pilot'
              ? 'The pilot accepts its imported WHIDs and evaluates only eligible PEB listings. All evaluation and review data stays in the local QA database.'
              : 'Reads the selected warehouses and stores QA suggestions for admin review. Source values are never changed by evaluation.'}
          </p>
        </ResponsiveModal>
      )}
    </section>
  );
}
