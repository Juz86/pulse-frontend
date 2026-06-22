import React from 'react';
import { Search } from './Icons';

const PulseSearchPill = React.forwardRef(function PulseSearchPill({
  value,
  onChange,
  placeholder = 'Zoeken…',
  ariaLabel = 'Zoeken',
  className = '',
  ...props
}, ref) {
  return (
    <label className={`pulse-search-pill${className ? ` ${className}` : ''}`}>
      <Search size={17} className="pulse-search-pill__icon" aria-hidden="true" />
      <input
        ref={ref}
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
    </label>
  );
});

export default PulseSearchPill;
