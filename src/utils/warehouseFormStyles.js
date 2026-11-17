export const inputBase = (mobile) => ({
  width: '100%',
  minHeight: mobile ? 44 : 36,
  padding: mobile ? '10px 14px' : '6px 11px',
  fontSize: mobile ? 16 : 14,
  background: 'var(--bg-primary, #141414)',
  border: '1px solid var(--border-primary, #303030)',
  borderRadius: 8,
  color: 'var(--text-primary, #fff)',
  outline: 'none',
  boxSizing: 'border-box',
});
