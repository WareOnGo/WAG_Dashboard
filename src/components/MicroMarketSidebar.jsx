import { useMemo, useState } from 'react'

const ICON = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round',
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...ICON}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...ICON}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function StatRow({ label, loading, count, show, onToggle }) {
  return (
    <div className="mm-stat-row">
      <span className="mm-stat-label">{label}</span>
      <span className="mm-stat-count">
        {loading ? <span className="mm-spinner" /> : (count ?? 0).toLocaleString()}
      </span>
      <button
        type="button"
        className={`mm-eye-toggle${show ? '' : ' off'}`}
        onClick={onToggle}
        title={`${show ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        aria-label={`${show ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        aria-pressed={show}
      >
        {show ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </div>
  )
}

// Group by the *committed* city so editing the city field doesn't re-group (and
// drop focus) on every keystroke — only on blur/commit.
const groupCityOf = (a) => (a.groupCity ?? a.city ?? '').trim()

export default function MicroMarketSidebar({
  areas,
  selectedId,
  loadingAreas,
  loadingWarehouses,
  warehouseCount,
  showAreas,
  onToggleAreas,
  showPins,
  onTogglePins,
  onFocus,
  onChangeMeta,
  onCommitMeta,
  onDelete,
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return areas
    return areas.filter(a =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.city || '').toLowerCase().includes(q)
    )
  }, [areas, query])

  // [ [cityKey, items], ... ] sorted alphabetically, "no city" last.
  const groups = useMemo(() => {
    const m = new Map()
    for (const a of filtered) {
      const key = groupCityOf(a)
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(a)
    }
    return [...m.entries()].sort((x, y) => {
      if (x[0] === '') return 1
      if (y[0] === '') return -1
      return x[0].localeCompare(y[0])
    })
  }, [filtered])

  const renderCard = (a) => (
    <li key={a.id} className={`mm-area${a.id === selectedId ? ' selected' : ''}`}>
      <button className="mm-area-head" type="button" onClick={() => onFocus(a.id)}>
        <span className="mm-dot" />
        <strong>{a.name || 'Untitled area'}</strong>
        {a.city ? <span className="mm-muted"> · {a.city}</span> : null}
      </button>
      <input
        className="mm-field"
        placeholder="Micro-market name"
        value={a.name}
        onChange={e => onChangeMeta(a.id, { name: e.target.value })}
        onBlur={() => onCommitMeta(a.id)}
      />
      <input
        className="mm-field"
        placeholder="City"
        value={a.city}
        onChange={e => onChangeMeta(a.id, { city: e.target.value })}
        onBlur={() => onCommitMeta(a.id)}
      />
      {a.reviewerName || a.reviewerEmail ? (
        <span className="mm-reviewer">marked by {a.reviewerName || a.reviewerEmail}</span>
      ) : null}
      <button className="mm-del" type="button" onClick={() => onDelete(a.id)}>
        Delete
      </button>
    </li>
  )

  return (
    <aside className="mm-sidebar">
      <header className="mm-sidebar-head">
        <h2>Micro-Markets</h2>
        <p className="mm-hint">
          Click the polygon tool (top-left of the map), click to drop vertices,
          and double-click to close the shape. Then name it below.
        </p>
      </header>

      <div className="mm-stats">
        <StatRow
          label="Areas"
          loading={loadingAreas}
          count={areas.length}
          show={showAreas}
          onToggle={onToggleAreas}
        />
        <StatRow
          label="Warehouse pins"
          loading={loadingWarehouses}
          count={warehouseCount}
          show={showPins}
          onToggle={onTogglePins}
        />
      </div>

      {!loadingAreas && areas.length > 0 && (
        <div className="mm-search">
          <input
            type="search"
            className="mm-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or city…"
            aria-label="Search areas by name or city"
          />
        </div>
      )}

      <div className="mm-area-list">
        {loadingAreas && <div className="mm-empty">Loading saved areas…</div>}
        {!loadingAreas && areas.length === 0 && (
          <div className="mm-empty">No areas yet — draw one to get started.</div>
        )}
        {!loadingAreas && areas.length > 0 && filtered.length === 0 && (
          <div className="mm-empty">No areas match “{query}”.</div>
        )}
        {groups.map(([city, items]) => (
          <details className="mm-group" key={city || '__nocity__'} open>
            <summary className="mm-group-head">
              <span className="mm-chevron" aria-hidden="true" />
              <span className="mm-group-name">{city || 'No city'}</span>
              <span className="mm-group-count">{items.length}</span>
            </summary>
            <ul className="mm-group-list">
              {items.map(renderCard)}
            </ul>
          </details>
        ))}
      </div>
    </aside>
  )
}
