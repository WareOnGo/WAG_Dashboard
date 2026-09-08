import { useEffect, useState } from 'react'
import { Alert, Button, Drawer, Modal } from 'antd'
import { POI_CATEGORIES } from '../utils/geoIcons'

export default function GeoPointEditor({ at, existing, draft, isMobile, onCancel, onChangeLocation, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [viewport, setViewport] = useState(null)
  useEffect(() => {
    if (!isMobile || !window.visualViewport) return
    const visual = window.visualViewport
    const update = () => setViewport({ height: visual.height, top: visual.offsetTop, bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop) })
    update()
    visual.addEventListener('resize', update)
    visual.addEventListener('scroll', update)
    return () => { visual.removeEventListener('resize', update); visual.removeEventListener('scroll', update) }
  }, [isMobile])
  const values = existing || draft
  const title = existing ? 'Edit point' : 'Add point details'
  const submit = async event => {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    body.name = body.name.trim()
    if (!body.name) { setError('Enter a name for this point.'); return }
    setSaving(true)
    setError('')
    try { await onSave(body) } catch (err) {
      setError(err?.message || 'Could not save. Your details are still here; try again.')
      setSaving(false)
    }
  }
  const content = <form id="geo-point-form" className="geo-point-form" onSubmit={submit}>
    <p className="geo-panel-help">{existing ? 'Update the details for this saved place.' : 'Step 2 of 2 · Save this place in Our points.'}</p>
    <div className="geo-location-summary"><span>Pin location<br /><strong>{at.lat.toFixed(5)}, {at.lng.toFixed(5)}</strong></span>
      {!existing && <Button disabled={saving} onClick={() => onChangeLocation(Object.fromEntries(new FormData(document.getElementById('geo-point-form'))))}>Reposition</Button>}
    </div>
    <label htmlFor="geo-point-name">Name <span>(required)</span></label>
    <input id="geo-point-name" name="name" placeholder="e.g. Hosur distribution site" required maxLength={200} defaultValue={values?.name ?? ''} disabled={saving} />
    <label htmlFor="geo-point-category">Point type <span>(required)</span></label>
    <select id="geo-point-category" name="category" required disabled={saving}
      defaultValue={POI_CATEGORIES.some(c => c.value === values?.category) ? values.category : ''}>
      <option value="" disabled>Choose a point type</option>
      {POI_CATEGORIES.map(c => <option value={c.value} key={c.value}>{c.label}</option>)}
    </select>
    <label htmlFor="geo-point-notes">Notes <span>(optional)</span></label>
    <textarea id="geo-point-notes" name="notes" rows={3} placeholder="Access, landmarks or useful context" defaultValue={values?.notes ?? ''} disabled={saving} />
    {error && <Alert role="alert" type="error" showIcon message={error} />}
  </form>
  const footer = <div className="geo-editor-actions">
    <Button disabled={saving} onClick={onCancel}>Cancel</Button>
    <Button type="primary" htmlType="submit" form="geo-point-form" loading={saving}>Save point</Button>
  </div>
  return isMobile
    ? <Drawer open placement="bottom" title={title} height={viewport ? Math.min(viewport.height * .82, 680) : 'min(82dvh, 680px)'} rootClassName="geo-editor-drawer"
        rootStyle={viewport ? { top: viewport.top, bottom: viewport.bottom } : undefined}
        onClose={onCancel} maskClosable={false} closable={!saving} keyboard={!saving} footer={footer}>{content}</Drawer>
    : <Modal open title={title} onCancel={onCancel} maskClosable={false} closable={!saving} keyboard={!saving} footer={footer}>{content}</Modal>
}
