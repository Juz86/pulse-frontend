export function isRecoverableE2eeBackendFailure(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'TypeError'
    || !Number.isInteger(error?.status)
    || error.status === 0
    || error.status >= 500
    || message.includes('failed to fetch')
    || message.includes('network request failed');
}
