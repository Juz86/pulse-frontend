import React from 'react';

export default function PulseLogo({ size = 32, textSize = 22, color = '#fff', gap = 10 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap }}>
      {/* Icoon: het echte app-icoon */}
      <img
        src="/logo192.png"
        alt="Pulse"
        width={size}
        height={size}
        style={{ borderRadius: Math.round(size * 0.22), flexShrink: 0 }}
      />

      {/* Tekst: Pulse — vet, zelfde kleur als foto 2 */}
      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 800,
        fontSize: textSize,
        letterSpacing: '-0.3px',
        lineHeight: 1,
        background: `linear-gradient(135deg, ${color} 20%, #8b5cf6)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        Pulse
      </span>
    </div>
  );
}
