import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  App, Avatar, Button, Empty, Form, Input, Modal, Result, Segmented, Skeleton, Space, Switch, Tag,
  Tooltip, Typography,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, SearchOutlined, EditOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts'
import { useViewport } from '../hooks/useViewport'
import { verifiedNumberService } from '../services/verifiedNumberService'
import ResponsiveTable from './ResponsiveTable'
import './AdminUsers.css'

const { Text } = Typography

/**
 * The four capability columns on VerifiedNumber, in the order they're shown.
 * `adminAccess` implies every other capability server-side, which is why the
 * others render as inherited (rather than off) for an admin.
 */
const CAPABILITIES = [
  { key: 'dashboardAccess', label: 'Dashboard', hint: 'Access the warehouse dashboard' },
  { key: 'callDashboardAccess', label: 'Calls', hint: 'Access the call dashboard' },
  { key: 'reviewerAccess', label: 'Reviewer', hint: 'Review staged submissions and micro-markets' },
  { key: 'adminAccess', label: 'Admin', hint: 'Full access, including this panel' },
]

/**
 * The backend's 403/409 guard messages are more useful than apiClient's generic
 * ones (it rewrites 403 to "Access forbidden"), so prefer the server's own text.
 */
const serverMessage = (err, fallback) =>
  err?.response?.data?.error || err?.message || fallback

const sameEmail = (a, b) =>
  !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase()

/** Up to two initials, for the row avatar. */
const initialsOf = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/**
 * AdminUsers — manage the employee roster and who can access what.
 *
 * `VerifiedNumber` is the identity table for the whole stack: this page is the
 * only place it is written from. Three things shape the UI:
 *
 *  - Capabilities toggle inline, because granting access is the common task and
 *    should not require opening a form.
 *  - There is no delete. Rows are referenced by the WhatsApp bot tables and by
 *    Employee -> Ticket, so offboarding deactivates instead.
 *  - Phone number and employee ID are identity keys other services join on. The
 *    server refuses to change them until the caller confirms, and this page
 *    surfaces what would move.
 */
export default function AdminUsers() {
  const { user } = useAuth()
  const { message, modal } = App.useApp()
  const { isMobile } = useViewport()
  const isAdmin = !!user?.isAdmin

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [savingIds, setSavingIds] = useState(() => new Set())

  const [editing, setEditing] = useState(null) // row being edited, or {} for create
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Only the newest request may write to state, so a slow response for an older
  // search term can't overwrite a newer one.
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    try {
      const data = await verifiedNumberService.adminList({
        search: debouncedSearch,
        includeInactive,
      })
      if (requestId !== requestRef.current) return
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      if (requestId !== requestRef.current) return
      message.error(serverMessage(err, 'Could not load the roster'))
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [debouncedSearch, includeInactive, message])

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin, load])

  const markSaving = (id, on) =>
    setSavingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })

  /** Describe what an identity-key change would drag along with it. */
  const describeDependents = (fields, dependents) => {
    const parts = []
    if (dependents?.whatsapp) parts.push(`${dependents.whatsapp} WhatsApp assistant record(s)`)
    if (dependents?.employee) parts.push(`${dependents.employee} employee/reimbursement record(s)`)
    const moving = parts.length ? parts.join(' and ') : 'no linked records'
    return (
      <>
        <p>Changing <strong>{fields.join(' and ')}</strong> will also update {moving}.</p>
        {fields.includes('empID') && (
          <p>Their Scout app login uses this employee ID and will stop working.</p>
        )}
      </>
    )
  }

  /**
   * PATCH a row, transparently handling the server's identity-change confirmation.
   * @returns {Promise<boolean>} true if the row was saved
   */
  const patchRow = useCallback(async (id, data) => {
    markSaving(id, true)
    try {
      const saved = await verifiedNumberService.adminUpdate(id, data)
      setRows((prev) => prev.map((r) => (r.id === id ? saved : r)))
      return true
    } catch (err) {
      const details = err?.response?.data?.details
      if (details?.requiresConfirmation) {
        const confirmed = await new Promise((resolve) => {
          modal.confirm({
            title: 'This changes a linked identity',
            content: describeDependents(details.fields || [], details.dependents),
            okText: 'Change it anyway',
            okButtonProps: { danger: true },
            cancelText: 'Cancel',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!confirmed) return false
        try {
          const saved = await verifiedNumberService.adminUpdate(id, {
            ...data,
            confirmIdentityChange: true,
          })
          setRows((prev) => prev.map((r) => (r.id === id ? saved : r)))
          return true
        } catch (retryErr) {
          message.error(serverMessage(retryErr, 'Could not save'))
          return false
        }
      }
      message.error(serverMessage(err, 'Could not save'))
      return false
    } finally {
      markSaving(id, false)
    }
  }, [message, modal])

  const toggleCapability = async (row, key, value) => {
    const ok = await patchRow(row.id, { [key]: value })
    if (ok) {
      const cap = CAPABILITIES.find((c) => c.key === key)
      message.success(`${value ? 'Granted' : 'Removed'} ${cap.label} for ${row.name}`)
    }
  }

  const toggleActive = (row, value) => {
    if (value) { patchRow(row.id, { is_active: true }); return }
    modal.confirm({
      title: `Deactivate ${row.name}?`,
      content:
        'They will lose all dashboard access immediately. Their record and history are kept, ' +
        'and you can reactivate them at any time.',
      okText: 'Deactivate',
      okButtonProps: { danger: true },
      onOk: () => patchRow(row.id, { is_active: false }),
    })
  }

  const openCreate = () => {
    setEditing({})
    form.setFieldsValue({ name: '', email: '', phone_number: '', role: '' })
  }

  const openEdit = (row) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name || '',
      email: row.email || '',
      phone_number: row.phone_number || '',
      empID: row.empID || '',
      role: row.role || '',
    })
  }

  const closeModal = () => { setEditing(null); form.resetFields() }

  const handleSubmit = async () => {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return // antd renders the field errors
    }

    setSubmitting(true)
    try {
      if (editing?.id) {
        // Send only what actually changed, so the audit diff stays meaningful and
        // an untouched phone number never trips the identity-change guard.
        const changed = {}
        for (const [k, v] of Object.entries(values)) {
          const before = editing[k] ?? ''
          if ((v ?? '') !== before) changed[k] = v === '' ? null : v
        }
        // name is required server-side; never send it as null.
        if (changed.name === null) delete changed.name
        if (!Object.keys(changed).length) { closeModal(); return }

        const ok = await patchRow(editing.id, changed)
        if (ok) { message.success(`Updated ${values.name}`); closeModal() }
      } else {
        const payload = { name: values.name }
        if (values.email) payload.email = values.email
        if (values.phone_number) payload.phone_number = values.phone_number
        if (values.role) payload.role = values.role

        const created = await verifiedNumberService.adminCreate(payload)
        setRows((prev) => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
        message.success(`Added ${created.name} (${created.empID})`)
        closeModal()
      }
    } catch (err) {
      message.error(serverMessage(err, 'Could not save'))
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * One capability control, shared by the desktop table and the phone cards.
   * `adminAccess` grants everything server-side, so the lesser switches render as
   * inherited for an admin rather than as "off", which would misstate their access.
   */
  const renderCapability = (cap, row) => {
    const isSelf = sameEmail(row.email, user?.email)
    const inherited = cap.key !== 'adminAccess' && row.adminAccess
    // Removing your own admin access would lock you out of this panel.
    const lockedSelf = cap.key === 'adminAccess' && isSelf && row[cap.key]

    if (inherited) {
      return <Tooltip title="Included with admin access"><Tag>via admin</Tag></Tooltip>
    }
    const control = (
      <Switch
        size="small"
        checked={!!row[cap.key]}
        disabled={lockedSelf || !row.is_active || savingIds.has(row.id)}
        onChange={(checked) => toggleCapability(row, cap.key, checked)}
      />
    )
    if (lockedSelf) return <Tooltip title="You can't remove your own admin access">{control}</Tooltip>
    if (!row.is_active) return <Tooltip title="Reactivate this employee first">{control}</Tooltip>
    return <Tooltip title={cap.hint}>{control}</Tooltip>
  }

  const renderActive = (row) => {
    const lockedSelf = sameEmail(row.email, user?.email) && row.is_active
    const control = (
      <Switch
        size="small"
        checked={!!row.is_active}
        disabled={lockedSelf || savingIds.has(row.id)}
        onChange={(checked) => toggleActive(row, checked)}
      />
    )
    return lockedSelf
      ? <Tooltip title="You can't deactivate your own account">{control}</Tooltip>
      : control
  }

  const columns = useMemo(() => {
    const capabilityColumns = CAPABILITIES.map((cap) => ({
      title: cap.label,
      key: cap.key,
      dataIndex: cap.key,
      width: 110,
      align: 'center',
      render: (_value, row) => renderCapability(cap, row),
    }))

    return [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 250,
        fixed: 'left',
        sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
        render: (name, row) => (
          <Space size={10} align="center">
            <Avatar size="small" className="admin-users__avatar">{initialsOf(name)}</Avatar>
            <Space direction="vertical" size={0}>
              <Space size={6} align="center">
                <Text strong>{name}</Text>
                {sameEmail(row.email, user?.email) && <Tag color="blue">you</Tag>}
              </Space>
              {!row.is_active && <Text type="secondary" className="admin-users__sub">Deactivated</Text>}
            </Space>
          </Space>
        ),
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
        width: 240,
        render: (email) =>
          email
            ? <Text copyable={{ text: email }}>{email}</Text>
            : <Tooltip title="Without an email they cannot sign in to the dashboard">
                <Tag color="warning">no email</Tag>
              </Tooltip>,
      },
      { title: 'Phone', dataIndex: 'phone_number', key: 'phone_number', width: 150 },
      {
        title: 'Emp ID',
        dataIndex: 'empID',
        key: 'empID',
        width: 110,
        render: (empID) => (empID ? <Text code>{empID}</Text> : <Text type="secondary">—</Text>),
      },
      // Grouped so the four switches read as one thing — "what can they reach" —
      // rather than as four unrelated columns sitting beside the identity fields.
      {
        title: 'Access',
        key: 'access',
        align: 'center',
        className: 'admin-users__group',
        children: capabilityColumns,
      },
      {
        title: 'Active',
        dataIndex: 'is_active',
        key: 'is_active',
        width: 90,
        align: 'center',
        render: (_value, row) => renderActive(row),
      },
      {
        title: '',
        key: 'actions',
        width: 80,
        fixed: 'right',
        align: 'center',
        render: (_, row) => (
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            Edit
          </Button>
        ),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savingIds, user?.email])

  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="Admins only"
        subTitle="You need the admin capability to manage employee access."
      />
    )
  }

  const isCreate = editing != null && !editing.id

  const emptyState = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        debouncedSearch
          ? `No employee matches "${debouncedSearch}"`
          : includeInactive
            ? 'No employees yet'
            : 'No active employees — try "Show inactive"'
      }
    />
  )

  // Counted off the rows actually on screen, so the numbers always agree with
  // the table below them (including while a search is narrowing it).
  const stats = [
    { label: rows.length === 1 ? 'employee' : 'employees', value: rows.length },
    { label: 'admins', value: rows.filter((r) => r.is_active && r.adminAccess).length },
    {
      label: 'reviewers',
      value: rows.filter((r) => r.is_active && (r.reviewerAccess || r.adminAccess)).length,
    },
    ...(includeInactive
      ? [{ label: 'deactivated', value: rows.filter((r) => !r.is_active).length }]
      : []),
  ]

  return (
    <div className="admin-users">
      <div className="admin-users__header">
        <div className="admin-users__intro">
          <h2 className="admin-users__title">Admin Panel</h2>
          <Text type="secondary">
            Employee access — who can sign in and what they can reach. Changes take effect
            on their next page load.
          </Text>
          <div className="admin-users__stats">
            {stats.map((s) => (
              <span key={s.label} className="admin-users__stat">
                <strong>{s.value}</strong> {s.label}
              </span>
            ))}
          </div>
        </div>
        {/* Two clusters: what you're looking at on the left, what you can do on
            the right. A loose switch between the two read as stray clutter, so
            the scope filter is a Segmented — the same control the review queue
            uses for its status tabs. */}
        <div className="admin-users__toolbar">
          <div className="admin-users__filters">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search name, email, phone, ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-users__search"
            />
            {isMobile ? (
              /* A full-width Segmented reads as a heavy slab on a phone. The card
                 list below is built from labelled rows with a switch on the right,
                 so the scope filter uses that same shape. */
              <div
                className="admin-users__scope"
                onClick={(e) => {
                  // Let the switch handle its own clicks (and keyboard) once.
                  if (!e.target.closest('.ant-switch')) setIncludeInactive((v) => !v)
                }}
              >
                <span>Show deactivated</span>
                <Switch size="small" checked={includeInactive} onChange={setIncludeInactive} />
              </div>
            ) : (
              <Segmented
                value={includeInactive ? 'all' : 'active'}
                onChange={(v) => setIncludeInactive(v === 'all')}
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'All', value: 'all' },
                ]}
              />
            )}
          </div>
          <div className="admin-users__actions">
            <Tooltip title="Reload the roster">
              <Button
                aria-label="Refresh"
                icon={<ReloadOutlined />}
                onClick={load}
                loading={loading}
              />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Add employee
            </Button>
          </div>
        </div>
      </div>

      {isMobile ? (
        /* A nine-column permissions grid is unreadable on a phone even when it
           scrolls, so the roster becomes a card per employee: identity on top,
           then one labelled row per capability, with a tap target the size of
           the row rather than a 20px switch inside a scrolling table. */
        <div className="admin-users__cards">
          {loading && <Skeleton active paragraph={{ rows: 6 }} />}
          {!loading && !rows.length && emptyState}
          {!loading && rows.map((row) => (
            <div
              key={row.id}
              className={`admin-users__card${row.is_active ? '' : ' admin-users__card--inactive'}`}
            >
              <div className="admin-users__card-head">
                <Avatar size="small" className="admin-users__avatar">{initialsOf(row.name)}</Avatar>
                <div className="admin-users__card-id">
                  <Space size={6} align="center" wrap>
                    <Text strong>{row.name}</Text>
                    {sameEmail(row.email, user?.email) && <Tag color="blue">you</Tag>}
                    {!row.is_active && <Tag>deactivated</Tag>}
                  </Space>
                  {row.email
                    ? <Text type="secondary" className="admin-users__sub">{row.email}</Text>
                    : <Tag color="warning">no email — cannot sign in</Tag>}
                  <Text type="secondary" className="admin-users__sub">
                    {row.phone_number || 'no phone'} · {row.empID || 'no ID'}
                  </Text>
                </div>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                  Edit
                </Button>
              </div>

              <div className="admin-users__card-caps">
                {CAPABILITIES.map((cap) => (
                  <div key={cap.key} className="admin-users__card-cap">
                    <span>{cap.label}</span>
                    {renderCapability(cap, row)}
                  </div>
                ))}
                <div className="admin-users__card-cap admin-users__card-cap--active">
                  <span>Active</span>
                  {renderActive(row)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ResponsiveTable
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={false}
          scroll={{ x: 1360 }}
          rowClassName={(row) => (row.is_active ? '' : 'admin-users__row--inactive')}
          locale={{ emptyText: loading ? ' ' : emptyState }}
        />
      )}

      <Modal
        open={editing != null}
        title={isCreate ? 'Add employee' : `Edit ${editing?.name || ''}`}
        onCancel={closeModal}
        onOk={handleSubmit}
        okText={isCreate ? 'Add' : 'Save'}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="Asha Kumar" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Work email"
            extra="This is what dashboard access is matched on. Without it they cannot sign in."
            rules={[{ type: 'email', message: 'Enter a valid email address' }]}
          >
            <Input placeholder="asha@wareongo.com" />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label="Phone number"
            extra={
              isCreate
                ? 'Used by the WhatsApp assistant.'
                : 'Linked to their WhatsApp assistant history — you will be asked to confirm a change.'
            }
          >
            <Input placeholder="+91 XXXXX XXXXX" />
          </Form.Item>

          {!isCreate && (
            <Form.Item
              name="empID"
              label="Employee ID"
              extra="Used as their Scout app login. Changing it will sign them out of Scout."
            >
              <Input />
            </Form.Item>
          )}

          <Form.Item
            name="role"
            label="Role"
            extra="A free-text label. It does not affect access — use the capability switches for that."
          >
            <Input placeholder="EMPLOYEE" />
          </Form.Item>

          {isCreate && (
            <Text type="secondary">
              An employee ID is generated automatically. Grant access with the switches
              once they appear in the list.
            </Text>
          )}
        </Form>
      </Modal>
    </div>
  )
}
