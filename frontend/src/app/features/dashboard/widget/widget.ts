import { Component, OnInit, inject, signal, computed, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WidgetConfigService } from './widget-config.service';
import { WidgetConfig, WidgetMode, WidgetPosition, DEFAULT_CONFIG, PRESET_COLORS } from './widget.types';
import { environment } from '../../../../environments/environment';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
    selector: 'app-widget',
    imports: [CommonModule, FormsModule],
    templateUrl: './widget.html',
    styleUrl: './widget.scss',
})

export class Widget implements OnInit {
    private readonly service = inject(WidgetConfigService);
    private readonly dashboardContext = inject(DashboardContextService);    
    private readonly route = inject(ActivatedRoute);

    // ─── State ────────────────────────────────────────────────
    loading = signal(true);
    saving = signal(false);
    saved = signal(false);
    error = signal('');

    config = signal<WidgetConfig>({ ...DEFAULT_CONFIG });
    project = this.dashboardContext.selectedProject;

    // ─── Preview state ────────────────────────────────────────
    previewOpen = signal(false);

    // ─── Constantes ───────────────────────────────────────────
    readonly presetColors = PRESET_COLORS;
    readonly modes: { value: WidgetMode; label: string; desc: string; icon: string }[] = [
        {
            value: 'floating',
            label: 'Flottant',
            desc: 'Bouton fixe en bas de page',
            icon: 'M12 2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8z'
        },
        {
            value: 'inline',
            label: 'Intégré',
            desc: 'Formulaire dans la page',
            icon: 'M3 5h18M3 10h18M3 15h10'
        },
        {
            value: 'both',
            label: 'Les deux',
            desc: 'Bouton + formulaire',
            icon: 'M4 6h16M4 12h8m-8 6h16'
        },
    ];

    readonly positions: { value: WidgetPosition; label: string }[] = [
        { value: 'bottom-right', label: 'Bas droite' },
        { value: 'bottom-left', label: 'Bas gauche' },
    ];

    // ─── Snippet généré ───────────────────────────────────────
    readonly snippet = computed(() => {
        const c = this.config();
        return `<script src="${environment.widgetCdnUrl}"></script>
        <ai-review-hub
            token="${this.project()?.publicToken}"
            api-url="${environment.apiUrl}"
            mode="${c.mode}"
            title="${c.title}"
            placeholder="${c.placeholder}"
            primary-color="${c.primaryColor}"
            position="${c.position}">
        </ai-review-hub>`;
    });

    readonly snippetNpmModule = computed(() => {
        const c = this.config();
        return `import 'ai-review-hub-widget';
        // Dans votre composant HTML :
        // <ai-review-hub
        //   token="${this.project()?.publicToken}"
        //   mode="${c.mode}"
        //   primary-color="${c.primaryColor}">
        // </ai-review-hub>`;
    });

    // ─── Onglet snippet actif ─────────────────────────────────
    activeSnippetTab = signal<'cdn' | 'npm'>('cdn');
    copiedSnippet = signal(false);

    // ─── Lifecycle ────────────────────────────────────────────
    ngOnInit(): void {
        const projectId = this.project()?.id;
        if (!projectId) { this.loading.set(false); return; }

        this.service.getConfig(projectId).subscribe({
            next: (config) => {
                this.config.set(config);
                this.loading.set(false);
            },
            error: () => {
                // Config par défaut si pas encore sauvegardée
                this.loading.set(false);
            }
        });
    }

    // ─── Config updates ───────────────────────────────────────
    updateConfig(partial: Partial<WidgetConfig>): void {
        this.config.update(c => ({ ...c, ...partial }));
    }

    // ─── Sauvegarde ───────────────────────────────────────────
    save(): void {
        const projectId = this.project()?.id;
        if (!projectId) return;

        this.saving.set(true);
        this.error.set('');

        this.service.saveConfig(projectId, this.config()).subscribe({
            next: () => {
                this.saving.set(false);
                this.saved.set(true);
                setTimeout(() => this.saved.set(false), 2500);
            },
            error: () => {
                this.saving.set(false);
                this.error.set('Erreur lors de la sauvegarde.');
            }
        });
    }

    // ─── Reset ────────────────────────────────────────────────
    reset(): void {
        this.config.set({ ...DEFAULT_CONFIG });
    }

    // ─── Copier le snippet ────────────────────────────────────
    async copySnippet(): Promise<void> {
        const text = this.activeSnippetTab() === 'cdn'
            ? this.snippet()
            : this.snippetNpmModule();

        try {
            await navigator.clipboard.writeText(text);
            this.copiedSnippet.set(true);
            setTimeout(() => this.copiedSnippet.set(false), 2000);
        } catch {
            // fallback silencieux
        }
    }
}