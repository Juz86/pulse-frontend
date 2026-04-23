import { getWebAppLoginUrl, isLandingBuild } from '../lib/siteTarget';
import { requestMarketingAuth } from '../lib/marketingAuthEvents';

export default function useMarketingAuth({ onParentClick } = {}) {
  const openWebAppInNewTab = (url) => {
    const nextWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (nextWindow) {
      nextWindow.opener = null;
    }
  };

  const openParentSignup = () => {
    if (isLandingBuild) {
      openWebAppInNewTab(getWebAppLoginUrl({ role: 'parent', mode: 'register' }));
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
      openWebAppInNewTab(getWebAppLoginUrl({ role: 'parent', mode: 'login' }));
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
