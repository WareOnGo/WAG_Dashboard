import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import MicroMarketSidebar from '../MicroMarketSidebar'

/**
 * Selecting a polygon on the map highlights its sidebar card. With 100+ areas the
 * card is usually scrolled out of view, so the highlight is invisible without this.
 * jsdom does not implement scrollIntoView, so it is stubbed and asserted on.
 */
const AREAS = [
  { id: 'a1', name: 'Nelamangala', city: 'Bengaluru', groupCity: 'Bengaluru' },
  { id: 'a2', name: 'Peenya', city: 'Bengaluru', groupCity: 'Bengaluru' },
  { id: 'a3', name: 'Bhiwandi', city: 'Mumbai', groupCity: 'Mumbai' },
]

const setup = (props = {}) => render(
  <MicroMarketSidebar
    areas={AREAS}
    selectedId={null}
    loadingAreas={false}
    loadingWarehouses={false}
    warehouseCount={0}
    showAreas
    showPins
    onToggleAreas={vi.fn()}
    onTogglePins={vi.fn()}
    onFocus={vi.fn()}
    onChangeMeta={vi.fn()}
    onCommitMeta={vi.fn()}
    onDelete={vi.fn()}
    {...props}
  />,
)

/** The <li> card for an area, found via its rendered name. */
const cardFor = (container, name) =>
  [...container.querySelectorAll('li.mm-area')].find(li => li.textContent.includes(name))

let scrollIntoView

beforeEach(() => {
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
})

describe('MicroMarketSidebar auto-scroll to selection', () => {
  it('scrolls the selected card into view', () => {
    const { container } = setup({ selectedId: 'a3' })

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    // Called on the selected card itself, not some other element.
    expect(scrollIntoView.mock.instances[0]).toBe(cardFor(container, 'Bhiwandi'))
  })

  it('uses block:nearest so an already-visible card is not re-centred', () => {
    setup({ selectedId: 'a1' })
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'nearest', behavior: 'smooth' }),
    )
  })

  it('does not scroll when nothing is selected', () => {
    setup({ selectedId: null })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls again when the selection moves to another area', () => {
    const { rerender, container } = setup({ selectedId: 'a1' })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    rerender(
      <MicroMarketSidebar
        areas={AREAS} selectedId="a2" loadingAreas={false} loadingWarehouses={false}
        warehouseCount={0} showAreas showPins onToggleAreas={vi.fn()} onTogglePins={vi.fn()}
        onFocus={vi.fn()} onChangeMeta={vi.fn()} onCommitMeta={vi.fn()} onDelete={vi.fn()}
      />,
    )

    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    expect(scrollIntoView.mock.instances[1]).toBe(cardFor(container, 'Peenya'))
  })

  it('marks the selected card so the highlight and the scroll agree', () => {
    const { container } = setup({ selectedId: 'a3' })
    const selected = container.querySelectorAll('li.mm-area.selected')
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toContain('Bhiwandi')
  })

  it('opens a collapsed city group before scrolling, so the card is actually visible', () => {
    // Must collapse and then select within the SAME render: a fresh render would
    // start with the group open again and the assertion would prove nothing.
    const { container, rerender } = setup({ selectedId: null })
    const group = cardFor(container, 'Bhiwandi').closest('details')
    group.open = false                       // as a user can — these are uncontrolled
    expect(group.open).toBe(false)           // guard: the premise actually holds

    rerender(
      <MicroMarketSidebar
        areas={AREAS} selectedId="a3" loadingAreas={false} loadingWarehouses={false}
        warehouseCount={0} showAreas showPins onToggleAreas={vi.fn()} onTogglePins={vi.fn()}
        onFocus={vi.fn()} onChangeMeta={vi.fn()} onCommitMeta={vi.fn()} onDelete={vi.fn()}
      />,
    )

    expect(group.open).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('does not throw when the selected area is filtered out of the list', () => {
    // An id that renders no card at all — the search-filtered case.
    expect(() => setup({ selectedId: 'does-not-exist' })).not.toThrow()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('skips smooth scrolling when the user prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    setup({ selectedId: 'a1' })
    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    )
  })
})
