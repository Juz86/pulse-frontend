import { getWebAppLoginUrl, isLandingBuild } from '../lib/siteTarget';
import { requestMarketingAuth } from '../lib/marketingAuthEvents';

export default function useMarketingAuth({ onParentClick } = {}) {
  const openParentSignup = () => {
    if (isLandingBuild) {
      window.location.assign(getWebAppLoginUrl({ role: 'parent', mode: 'register' }));
      return;
    }
    if (onParentClick) {
      onParentClick('register');
      return;
    }
    requestMarketingAuth({ role: 'parent', mode: 'register' });
  };

  const openLogin = () => {
    if (isLandingBuild) {
      window.location.assign(getWebAppLoginUrl({ role: 'parent', mode: 'login' }));
      return;
    }
    if (onParentClick) {
      onParentClick('login');
      return;
    }
    requestMarketingAuth({ role: 'parent', mode: 'login' });
  };

  return { openParentSignup, openLogin, modals: null };
}
