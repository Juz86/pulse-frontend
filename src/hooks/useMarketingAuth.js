import { lazy, Suspense, useState } from 'react';
import { getWebAppLoginUrl, isLandingBuild } from '../lib/siteTarget';

const AuthModal = lazy(() => import('../components/AuthModal'));
const ParentAuthModal = lazy(() => import('../components/ParentAuthModal'));

export default function useMarketingAuth({ onParentClick } = {}) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);

  const openParentSignup = () => {
    if (isLandingBuild) {
      window.location.assign(getWebAppLoginUrl({ role: 'parent', mode: 'register' }));
      return;
    }
    setShowParentModal(true);
  };

  const openLogin = () => {
    if (isLandingBuild) {
      window.location.assign(getWebAppLoginUrl({ role: 'parent', mode: 'login' }));
      return;
    }
    setShowAuthModal(true);
  };

  const modals = isLandingBuild ? null : (
    <Suspense fallback={null}>
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onParentClick={onParentClick}
        />
      )}
      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}
    </Suspense>
  );

  return { openParentSignup, openLogin, modals };
}
