export const styles = `
  :host {
    --arh-primary:    #3B82F6;
    --arh-primary-h:  #2563EB;
    --arh-success:    #10B981;
    --arh-error:      #F43F5E;
    --arh-bg:         #ffffff;
    --arh-text:       #111827;
    --arh-text-sub:   #6B7280;
    --arh-border:     #E5E7EB;
    --arh-radius:     12px;
    --arh-shadow:     0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    box-sizing: border-box;
  }

  *, *::before, *::after { box-sizing: inherit; }

  /* ── Bouton flottant ───────────────────────────────────── */
  .trigger {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: var(--arh-primary);
    color: white;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(59,130,246,0.4);
    transition: all 0.2s ease;
    user-select: none;
    letter-spacing: 0.01em;
  }

  .trigger:hover {
    background: var(--arh-primary-h);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(59,130,246,0.45);
  }

  .trigger:active { transform: translateY(0); }

  .trigger svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    transition: transform 0.3s ease;
  }

  .trigger--open svg.icon-chat   { display: none; }
  .trigger--open svg.icon-close  { display: block; }
  .trigger svg.icon-close        { display: none; }

  /* ── Panel ─────────────────────────────────────────────── */
  .panel {
    position: fixed;
    bottom: 88px;
    right: 24px;
    z-index: 999998;
    width: 360px;
    max-width: calc(100vw - 48px);
    background: var(--arh-bg);
    border-radius: var(--arh-radius);
    box-shadow: var(--arh-shadow);
    border: 1px solid var(--arh-border);
    overflow: hidden;
    transform-origin: bottom right;
    transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
  }

  .panel--hidden {
    opacity: 0;
    transform: scale(0.85) translateY(12px);
    pointer-events: none;
  }

  .panel--visible {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  /* ── Header panel ──────────────────────────────────────── */
  .panel__header {
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--arh-primary), #6366F1);
    color: white;
  }

  .panel__title {
    font-size: 15px;
    font-weight: 700;
    margin: 0 0 2px;
  }

  .panel__subtitle {
    font-size: 12px;
    opacity: 0.85;
    margin: 0;
  }

  /* ── Inline ─────────────────────────────────────────────── */
  .inline {
    width: 100%;
    background: var(--arh-bg);
    border-radius: var(--arh-radius);
    border: 1px solid var(--arh-border);
    overflow: hidden;
  }

  /* ── Formulaire ────────────────────────────────────────── */
  .form {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--arh-text);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .field__textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid var(--arh-border);
    border-radius: 8px;
    background: #F9FAFB;
    color: var(--arh-text);
    font-size: 13px;
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .field__textarea:focus {
    border-color: var(--arh-primary);
    background: white;
  }

  .field__textarea::placeholder { color: #9CA3AF; }

  .field__counter {
    font-size: 11px;
    color: var(--arh-text-sub);
    text-align: right;
  }

  .field__counter--warn { color: var(--arh-error); }

  .widget-honeypot {
    opacity: 0;
    position: absolute;
    top: 0;
    left: 0;
    height: 0;
    width: 0;
    z-index: -1;
    pointer-events: none;
  }

  /* ── Catégories ─────────────────────────────────────────── */
  .categories {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .category-btn {
    padding: 5px 10px;
    border-radius: 20px;
    border: 1.5px solid var(--arh-border);
    background: transparent;
    color: var(--arh-text-sub);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .category-btn:hover {
    border-color: var(--arh-primary);
    color: var(--arh-primary);
  }

  .category-btn--active {
    background: #EFF6FF;
    border-color: var(--arh-primary);
    color: var(--arh-primary);
    font-weight: 600;
  }

  /* ── Submit ─────────────────────────────────────────────── */
  .submit-btn {
    width: 100%;
    padding: 11px;
    background: var(--arh-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--arh-primary-h);
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* ── Spinner ─────────────────────────────────────────────── */
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Error ───────────────────────────────────────────────── */
  .error-msg {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #FFF1F2;
    border: 1px solid #FECDD3;
    border-radius: 6px;
    color: #BE123C;
    font-size: 12px;
  }

  .error-msg svg { width: 14px; height: 14px; flex-shrink: 0; }

  /* ── Success ─────────────────────────────────────────────── */
  .success {
    padding: 32px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    text-align: center;
    animation: successIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes successIn {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }

  .success__icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #F0FDF4;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--arh-success);
  }

  .success__icon svg { width: 28px; height: 28px; }

  .success__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--arh-text);
    margin: 0;
  }

  .success__desc {
    font-size: 13px;
    color: var(--arh-text-sub);
    margin: 0;
  }

  .success__again {
    margin-top: 4px;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1.5px solid var(--arh-border);
    background: transparent;
    color: var(--arh-text-sub);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .success__again:hover {
    border-color: var(--arh-primary);
    color: var(--arh-primary);
  }

  /* ── Footer ──────────────────────────────────────────────── */
  .panel__footer {
    padding: 10px 20px;
    border-top: 1px solid var(--arh-border);
    text-align: center;
    font-size: 11px;
    color: var(--arh-text-sub);
  }

  .panel__footer a {
    color: var(--arh-primary);
    text-decoration: none;
    font-weight: 500;
  }

  /* ── Responsive mobile ───────────────────────────────────── */
  @media (max-width: 480px) {
    .panel {
      bottom: 0;
      right: 0;
      left: 0;
      width: 100%;
      max-width: 100%;
      border-radius: var(--arh-radius) var(--arh-radius) 0 0;
      transform-origin: bottom center;
    }

    .trigger {
      bottom: 16px;
      right: 16px;
    }
  }
`;