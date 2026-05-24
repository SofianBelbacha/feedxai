import { styles } from './styles';
import { submitFeedback } from './api';

const MAX_LENGTH = 2000;
const MIN_LENGTH = 10;

const CATEGORIES = [
  { value: 'Bug', label: '🐛 Bug' },
  { value: 'FeatureRequest', label: '✨ Idée' },
  { value: 'Question', label: '❓ Question' },
  { value: 'Uncategorized', label: '💬 Autre' },
];

class AiReviewHubWidget extends HTMLElement {

  // ─── Attributs observés ───────────────────────────────────
  static get observedAttributes() {
    return ['token', 'api-url', 'mode', 'placeholder', 'title', 'primary-color'];
  }

  private shadow!: ShadowRoot;
  private state = {
    open: false,
    loading: false,
    success: false,
    error: '',
    content: '',
    category: '',
  };

  // ─── Lifecycle ────────────────────────────────────────────
  connectedCallback(): void {
    this.shadow = this.attachShadow({ mode: 'open' });
    this.applyCustomColors();
    this.render();
    this.attachEvents();
  }

  attributeChangedCallback(): void {
    if (this.shadow) {
      this.applyCustomColors();
      this.render();
      this.attachEvents();
    }
  }

  // ─── Getters ──────────────────────────────────────────────
  private get token(): string { return this.getAttribute('token') ?? ''; }
  private get apiUrl(): string { return this.getAttribute('api-url') ?? 'https://api.aireviewhub.com/api'; }
  private get mode(): string { return this.getAttribute('mode') ?? 'floating'; }
  private get placeholder(): string { return this.getAttribute('placeholder') ?? 'Décrivez votre retour, bug ou suggestion…'; }
  private get widgetTitle(): string { return this.getAttribute('title') ?? 'Votre avis compte'; }

  // ─── Couleurs personnalisables ────────────────────────────
  private applyCustomColors(): void {
    const primary = this.getAttribute('primary-color');
    if (primary) {
      this.style.setProperty('--arh-primary', primary);
    }
  }

  // ─── Rendu ────────────────────────────────────────────────
  private render(): void {
    const isInline = this.mode === 'inline';
    const isFloating = this.mode === 'floating' || this.mode === 'both' || !this.mode;
    const hasBoth = this.mode === 'both';

    this.shadow.innerHTML = `
      <style>${styles}</style>

      ${isFloating || hasBoth ? this.renderTrigger() : ''}

      ${hasBoth || isFloating
        ? `<div class="panel ${this.state.open ? 'panel--visible' : 'panel--hidden'}">
            ${this.renderPanelHeader()}
            ${this.renderFormContent()}
            ${this.renderFooter()}
           </div>`
        : ''}

      ${isInline
        ? `<div class="inline">
            ${this.renderFormContent()}
            ${this.renderFooter()}
           </div>`
        : ''}
    `;
  }

  private renderTrigger(): string {
    return `
      <button class="trigger ${this.state.open ? 'trigger--open' : ''}"
              data-action="toggle">
        <svg class="icon-chat" viewBox="0 0 20 20" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6l-4 4V5z"/>
        </svg>
        <svg class="icon-close" viewBox="0 0 20 20" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="4" x2="16" y2="16"/>
          <line x1="16" y1="4" x2="4" y2="16"/>
        </svg>
        ${this.state.open ? 'Fermer' : 'Feedback'}
      </button>
    `;
  }

  private renderPanelHeader(): string {
    return `
      <div class="panel__header">
        <p class="panel__title">${this.widgetTitle}</p>
        <p class="panel__subtitle">Aidez-nous à améliorer votre expérience</p>
      </div>
    `;
  }

  private renderFormContent(): string {
    if (this.state.success) return this.renderSuccess();
    return this.renderForm();
  }

  private renderForm(): string {
    const remaining = MAX_LENGTH - this.state.content.length;
    const isWarn = remaining < 100;
    const isValid = this.state.content.trim().length >= MIN_LENGTH;

    return `
      <div class="form">
        <div class="field">
          <label class="field__label">Votre retour</label>
          <textarea
            class="field__textarea"
            rows="4"
            maxlength="${MAX_LENGTH}"
            placeholder="${this.placeholder}"
            data-action="input"
          >${this.state.content}</textarea>
          <span class="field__counter ${isWarn ? 'field__counter--warn' : ''}">
            ${remaining} caractères restants
          </span>
          <input class="widget-honeypot" name="website" tabindex="-1" autocomplete="off" />
        </div>

        <div class="field">
          <label class="field__label">Catégorie</label>
          <div class="categories">
            ${CATEGORIES.map(cat => `
              <button
                class="category-btn ${this.state.category === cat.value ? 'category-btn--active' : ''}"
                data-action="category"
                data-value="${cat.value}">
                ${cat.label}
              </button>
            `).join('')}
          </div>
        </div>

        ${this.state.error ? `
          <div class="error-msg">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                 stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="8" r="7"/>
              <line x1="8" y1="5" x2="8" y2="8.5"/>
              <circle cx="8" cy="11" r="0.5" fill="currentColor"/>
            </svg>
            ${this.state.error}
          </div>
        ` : ''}

        <button
          class="submit-btn"
          data-action="submit"
          ${this.state.loading || !isValid ? 'disabled' : ''}>
          ${this.state.loading
        ? `<span class="spinner"></span> Envoi…`
        : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <line x1="3" y1="8" x2="13" y2="8"/>
                 <polyline points="9 4 13 8 9 12"/>
               </svg>
               Envoyer`
      }
        </button>
      </div>
    `;
  }

  private renderSuccess(): string {
    return `
      <div class="success">
        <div class="success__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h3 class="success__title">Merci pour votre retour !</h3>
        <p class="success__desc">
          Notre équipe l'analysera et reviendra vers vous si nécessaire.
        </p>
        <button class="success__again" data-action="reset">
          Envoyer un autre retour
        </button>
      </div>
    `;
  }

  private renderFooter(): string {
    return `
      <div class="panel__footer">
        Propulsé par <a href="https://aireviewhub.com" target="_blank">AI Review Hub</a>
      </div>
    `;
  }

  // ─── Events ───────────────────────────────────────────────
  private attachEvents(): void {
    this.shadow.addEventListener('click', e => this.handleClick(e));
    this.shadow.addEventListener('input', e => this.handleInput(e));
  }

  private handleClick(e: Event): void {
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;

    const action = target.dataset['action'];

    switch (action) {
      case 'toggle':
        this.state.open = !this.state.open;
        this.render();
        this.attachEvents();
        if (this.state.open) this.focusTextarea();
        break;

      case 'category':
        const value = target.dataset['value'] ?? '';
        this.state.category = this.state.category === value ? '' : value;
        this.render();
        this.attachEvents();
        break;

      case 'submit':
        this.handleSubmit();
        break;

      case 'reset':
        this.state = {
          ...this.state,
          success: false,
          error: '',
          content: '',
          category: '',
        };
        this.render();
        this.attachEvents();
        break;
    }
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLTextAreaElement;
    if (target.dataset['action'] === 'input') {
      this.state.content = target.value;
      // Mise à jour légère — juste le counter et le bouton
      this.updateCounter();
    }
  }

  private updateCounter(): void {
    const counter = this.shadow.querySelector('.field__counter');
    const btn = this.shadow.querySelector<HTMLButtonElement>('.submit-btn');
    const remaining = MAX_LENGTH - this.state.content.length;
    const isValid = this.state.content.trim().length >= MIN_LENGTH;

    if (counter) {
      counter.textContent = `${remaining} caractères restants`;
      counter.classList.toggle('field__counter--warn', remaining < 100);
    }

    if (btn) btn.disabled = this.state.loading || !isValid;
  }

  private async handleSubmit(): Promise<void> {
    if (this.state.loading) return;

    const content = this.state.content.trim();
    if (content.length < MIN_LENGTH) {
      this.state.error = `Minimum ${MIN_LENGTH} caractères requis.`;
      this.render();
      this.attachEvents();
      return;
    }

    if (!this.token) {
      this.state.error = 'Token de projet manquant.';
      this.render();
      this.attachEvents();
      return;
    }

    this.state.loading = true;
    this.state.error = '';
    this.render();
    this.attachEvents();

    try {
      await submitFeedback(this.apiUrl, {
        content,
        projectToken: this.token,
        category: this.state.category || undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      });

      this.state.success = true;
      this.state.loading = false;

      // Dispatch event pour le site hôte
      this.dispatchEvent(new CustomEvent('arh:feedback-submitted', {
        bubbles: true,
        composed: true,
        detail: { content, category: this.state.category }
      }));

    } catch (err) {
      this.state.loading = false;
      this.state.error = 'Erreur lors de l\'envoi. Réessayez.';
    }

    this.render();
    this.attachEvents();
  }

  private focusTextarea(): void {
    requestAnimationFrame(() => {
      const ta = this.shadow.querySelector<HTMLTextAreaElement>('textarea');
      ta?.focus();
    });
  }
}

// ─── Enregistrement du Web Component ──────────────────────
if (!customElements.get('ai-review-hub')) {
  customElements.define('ai-review-hub', AiReviewHubWidget);
}