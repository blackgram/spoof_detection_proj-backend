import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export default function FingerprintIcon({ size = 28, color = '#f97316' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 1a9 9 0 0 0-9 9v2a9 9 0 0 0 .7 3.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M20.3 15.5A9 9 0 0 0 21 12v-2a9 9 0 0 0-3-6.71"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M7 4.81A6 6 0 0 1 12 4a6 6 0 0 1 6 6v2a14.8 14.8 0 0 1-.6 4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M6.6 16A14.8 14.8 0 0 1 6 12v-2a6 6 0 0 1 .6-2.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 7a3 3 0 0 0-3 3v2c0 2.4.5 4.8 1.4 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M15 10a3 3 0 0 0-3-3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M15 12v2a17 17 0 0 1-1.2 6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 10v2a8.5 8.5 0 0 1-.8 3.6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
