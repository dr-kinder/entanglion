import React from 'react';
import { DETECTION_SCALE_DISPLAY } from '../engine/types';

interface DetectionTrackProps {
  currentIndex: number;
}

export default function DetectionTrack({ currentIndex }: DetectionTrackProps) {
  return (
    <div className="detection-track">
      <span className="detection-label">DETECTION RATE</span>
      <div className="detection-cells">
        {DETECTION_SCALE_DISPLAY.map((val, i) => {
          const isX = val === 'X';
          const isCurrent = i === currentIndex;
          return (
            <div
              key={i}
              className={`detection-cell ${isCurrent ? 'current' : ''} ${isX ? 'danger' : ''}`}
            >
              {val}
            </div>
          );
        })}
      </div>
    </div>
  );
}
