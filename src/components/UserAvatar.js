// src/components/UserAvatar.js
import React from 'react';
import { getInitials } from '../utils';

const UserAvatar = React.memo(function UserAvatar({ photoURL, displayName, className = '' }) {
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={displayName || ''}
        className={`avatar-circle ${className}`}
        style={{ objectFit: 'cover' }}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`avatar-circle ${className}`} aria-label={displayName}>
      {getInitials(displayName)}
    </div>
  );
});

export default UserAvatar;
