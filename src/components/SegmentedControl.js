import React from 'react';

export default function SegmentedControl({
  items,
  value,
  onChange,
  className = '',
}) {
  return (
    <div className={`segmented-control${className ? ` ${className}` : ''}`} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-control__item${active ? ' active' : ''}`}
            onClick={() => onChange(item.value)}
          >
            {item.icon ? <span className="segmented-control__icon" aria-hidden="true">{item.icon}</span> : null}
            <span className="segmented-control__label">{item.label}</span>
            {item.badge ? <span className="segmented-control__badge" aria-hidden="true">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
