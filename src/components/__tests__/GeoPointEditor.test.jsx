import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import GeoPointEditor from '../GeoPointEditor'

const at = { lat: 12.95, lng: 77.6 }
const draft = { name: 'Depot', category: 'POTENTIAL_WAREHOUSE', notes: 'East gate' }
const mount = props => render(<GeoPointEditor at={at} isMobile={false} onSave={vi.fn()} onCancel={vi.fn()} {...props} />)

describe('GIS point editor', () => {
  it('preserves the draft and sends only editable fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    mount({ draft, onSave })
    expect(screen.getByLabelText('Name (required)')).toHaveValue('Depot')
    fireEvent.click(screen.getByRole('button', { name: 'Save point' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(draft))
  })

  it('returns all typed values when repositioning', () => {
    const onChangeLocation = vi.fn()
    mount({ draft, onChangeLocation })
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'New landmark' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reposition' }))
    expect(onChangeLocation).toHaveBeenCalledWith({ ...draft, notes: 'New landmark' })
  })

  it('retains values and enables retry after a failed save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Offline. Try again.'))
    mount({ draft, onSave })
    fireEvent.click(screen.getByRole('button', { name: 'Save point' }))
    await screen.findByText('Offline. Try again.')
    expect(screen.getByLabelText('Name (required)')).toHaveValue('Depot')
    expect(screen.getByRole('button', { name: 'Save point' })).toBeEnabled()
  })

  it('requires migration of a legacy category before saving', () => {
    mount({ existing: { ...draft, category: 'icd' } })
    expect(screen.getByLabelText('Point type (required)')).toHaveValue('')
    expect(screen.getByLabelText('Point type (required)').checkValidity()).toBe(false)
  })

  it('rejects whitespace-only names without sending a request', async () => {
    const onSave = vi.fn()
    mount({ draft: { ...draft, name: '   ' }, onSave })
    fireEvent.click(screen.getByRole('button', { name: 'Save point' }))
    await screen.findByText('Enter a name for this point.')
    expect(onSave).not.toHaveBeenCalled()
  })
})
