// src/components/DecorativeAvatars.js
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import SafeSvgImage from './SafeSvgImage';

function makeAvatar(options) {
  return createAvatar(adventurer, {
    size: 72,
    backgroundColor: [],
    ...options,
  }).toString();
}

export const avatarSvgs = {
  // Functies / herbruikbaar bovenaan rechts
  heroTop: makeAvatar({
    seed: 'pulse-hero-top',
    hair: ['short12'],
    hairColor: ['e03fd8'],
    skinColor: ['ecad80'],
    eyes: ['variant09'],
    eyebrows: ['variant07'],
    mouth: ['variant12'],
    glasses: ['none'],
    glassesProbability: 0,
    hairProbability: 100,
  }),
  // Herbruikbaar onderaan rechts
  heroBottom: makeAvatar({
    seed: 'pulse-hero-bottom',
    hair: ['long11'],
    hairColor: ['6a4e35'],
    skinColor: ['f2d3b1'],
    eyes: ['variant20'],
    eyebrows: ['variant10'],
    mouth: ['variant18'],
    glasses: ['variant01'],
    glassesProbability: 100,
    hairProbability: 100,
  }),
  // Hoe werkt het
  hwTop: makeAvatar({
    seed: 'pulse-hw-top',
    hair: ['short04'],
    hairColor: ['0e0e0e'],
    skinColor: ['d08b5b'],
    eyes: ['variant06'],
    eyebrows: ['variant03'],
    mouth: ['variant20'],
    glasses: ['none'],
    glassesProbability: 0,
    hairProbability: 100,
  }),
  hwBottom: makeAvatar({
    seed: 'pulse-hw-bottom',
    hair: ['long17'],
    hairColor: ['a55728'],
    skinColor: ['f2d3b1'],
    eyes: ['variant12'],
    eyebrows: ['variant08'],
    mouth: ['variant26'],
    glasses: ['variant03'],
    glassesProbability: 100,
    hairProbability: 100,
  }),
  // Ouderlijk toezicht
  otTop: makeAvatar({
    seed: 'pulse-ot-top',
    hair: ['short01'],
    hairColor: ['2c1b18'],
    skinColor: ['c68642'],
    eyes: ['variant15'],
    eyebrows: ['variant05'],
    mouth: ['variant14'],
    glasses: ['none'],
    glassesProbability: 0,
    hairProbability: 100,
  }),
  otBottom: makeAvatar({
    seed: 'pulse-ot-bottom',
    hair: ['long06'],
    hairColor: ['e03fd8'],
    skinColor: ['ecad80'],
    eyes: ['variant04'],
    eyebrows: ['variant11'],
    mouth: ['variant07'],
    glasses: ['variant02'],
    glassesProbability: 100,
    hairProbability: 100,
  }),
  // Over Pulse
  opTop: makeAvatar({
    seed: 'pulse-op-top',
    hair: ['short10'],
    hairColor: ['cb6820'],
    skinColor: ['ae5d29'],
    eyes: ['variant08'],
    eyebrows: ['variant06'],
    mouth: ['variant23'],
    glasses: ['none'],
    glassesProbability: 0,
    hairProbability: 100,
  }),
  opBottom: makeAvatar({
    seed: 'pulse-op-bottom',
    hair: ['long22'],
    hairColor: ['0e0e0e'],
    skinColor: ['f2d3b1'],
    eyes: ['variant18'],
    eyebrows: ['variant12'],
    mouth: ['variant11'],
    glasses: ['variant01'],
    glassesProbability: 100,
    hairProbability: 100,
  }),
};

export default function DecorativeAvatar({ svg, className = '' }) {
  return (
    <SafeSvgImage
      svg={svg}
      alt=""
      className={`fp-deco-avatar ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    />
  );
}
