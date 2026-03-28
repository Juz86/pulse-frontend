// src/components/UserAvatar.js
import React from 'react';
import { getInitials } from '../utils';

const UserAvatar = React.memo(function UserAvatar({ photoURL, displayName, className = '', decorative = false }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={decorative ? '' : (displayName || '')}
        aria-hidden={decorative ? 'true' : undefined}
        className={`avatar-circle ${className}`}
        style={{ objectFit: 'cover' }}
        loading="lazy"
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
