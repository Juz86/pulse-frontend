export const MARKETING_AUTH_EVENT = 'pulse:marketing-auth';

export function requestMarketingAuth({ role = 'parent', mode = 'login' } = {}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(MARKETING_AUTH_EVENT, {
      detail: { role, mode },
    })
  );
}
