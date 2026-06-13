import React from 'react';
import Svg, { Path, G } from 'react-native-svg';

interface FixateLogoProps {
  size?: number;
  color?: string;
}

export default function FixateLogo({ size = 100, color = '#5DBEAA' }: FixateLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <G>
        {/* Wrench - diagonal from bottom-left to top-right */}
        <Path
          d="M 35 165 Q 30 160 35 155 L 55 135 Q 50 130 50 125 L 50 120 Q 50 115 55 110 L 70 95 Q 75 90 80 90 Q 85 90 90 95 L 95 100 L 125 70 Q 130 65 140 65 Q 150 65 160 75 Q 170 85 170 95 Q 170 105 165 110 L 135 140 L 140 145 Q 145 150 145 155 Q 145 160 140 165 L 125 180 Q 120 185 115 185 Q 110 185 105 180 L 100 175 L 70 205 Q 65 210 55 210 Q 45 210 40 200 Q 35 190 35 180 Q 35 170 40 165 Z M 145 85 Q 147 83 149 83 Q 151 83 153 85 Q 155 87 155 89 Q 155 91 153 93 Q 151 95 149 95 Q 147 95 145 93 Q 143 91 143 89 Q 143 87 145 85 Z"
          fill={color}
        />
        
        {/* Screwdriver - diagonal from top-left to bottom-right, crossing the wrench */}
        <Path
          d="M 30 30 L 40 40 L 50 50 L 60 60 L 70 70 L 80 80 L 90 90 L 100 100 L 110 110 L 120 120 L 130 130 L 140 140 L 150 150 Q 155 155 160 160 Q 165 165 165 170 Q 165 175 160 180 L 150 190 Q 145 195 140 195 Q 135 195 130 190 L 120 180 L 110 170 L 100 160 L 90 150 L 80 140 L 70 130 L 60 120 L 50 110 L 40 100 L 30 90 Q 25 85 25 80 Q 25 75 30 70 L 40 60 Q 45 55 50 55 Q 55 55 60 60 L 30 30 Z M 145 175 Q 147 173 149 173 Q 151 173 153 175 Q 155 177 155 179 Q 155 181 153 183 Q 151 185 149 185 Q 147 185 145 183 Q 143 181 143 179 Q 143 177 145 175 Z"
          fill={color}
        />
      </G>
    </Svg>
  );
}
