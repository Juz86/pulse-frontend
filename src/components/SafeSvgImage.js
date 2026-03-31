import { createSvgDataUrl } from '../utils';

export default function SafeSvgImage({ svg, alt = '', className = '', size, style, ...rest }) {
  const resolvedStyle = {
    display: 'block',
    ...style,
  };

  if (size) {
    resolvedStyle.width = resolvedStyle.width ?? size;
    resolvedStyle.height = resolvedStyle.height ?? size;
  }

  return (
    <img
      src={createSvgDataUrl(svg)}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      draggable="false"
      style={resolvedStyle}
      {...rest}
    />
  );
}
