import React from 'react';

// Shown when a newer build is deployed than the one currently running.
export default function UpdateBanner({ onReload }) {
  return (
    <div className="update-banner" data-testid="update-banner">
      <span>Ny version tilgængelig</span>
      <button className="btn btn-primary" onClick={onReload} data-testid="update-reload-btn">
        Genindlæs
      </button>
    </div>
  );
}
