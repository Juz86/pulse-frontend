// src/components/UserAvatar.js
import React, { useState } from 'react';
import { getInitials } from '../utils';

const UserAvatar = React.memo(function UserAvatar({ photoURL, displayName, className = '', decorative = false }) {
  const [imgError, setImgError] = useState(false);

  if (photoURL && !imgError) {
    return (
      <img
        src={photoURL}
        alt={decorative ? '' : (displayName || '')}
        aria-hidden={decorative ? 'true' : undefined}
        className={`avatar-circle ${className}`}
        style={{ objectFit: 'cover' }}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className={`avatar-circle ${className}`} aria-label={decorative ? undefined : displayName} aria-hidden={decorative ? 'true' : undefined}>
      {getInitials(displayName)}
    </div>
  );
});

export default UserAvatar;
