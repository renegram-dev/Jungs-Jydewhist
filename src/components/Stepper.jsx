import React from 'react';

// Large +/- numeric stepper for tricks. Big touch targets, no keyboard needed.
export default function Stepper({ label, value, min = 0, max = 13, onChange, testId }) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="stepper" data-testid={testId}>
      {label && <label className="field-label">{label}</label>}
      <div className="stepper-controls">
        <button
          type="button"
          className="btn btn-step"
          onClick={dec}
          disabled={value <= min}
          aria-label="Minus"
        >
          −
        </button>
        <span className="stepper-value" data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </span>
        <button
          type="button"
          className="btn btn-step"
          onClick={inc}
          disabled={value >= max}
          aria-label="Plus"
        >
          +
        </button>
      </div>
    </div>
  );
}
