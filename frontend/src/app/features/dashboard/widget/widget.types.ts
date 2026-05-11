export type WidgetMode = 'floating' | 'inline' | 'both';
export type WidgetPosition = 'bottom-right' | 'bottom-left';

export interface WidgetConfig {
    publicToken: string;
    mode: WidgetMode;
    position: WidgetPosition;
    primaryColor: string;
    title: string;
    placeholder: string;
    buttonLabel: string;
}

export const DEFAULT_CONFIG: WidgetConfig = {
    publicToken:  '',
    mode: 'floating',
    position: 'bottom-right',
    primaryColor: '#3B82F6',
    title: 'Votre avis compte',
    placeholder: 'Décrivez votre retour, bug ou suggestion…',
    buttonLabel: 'Feedback',
};

export const PRESET_COLORS = [
    { label: 'Bleu', value: '#3B82F6' },
    { label: 'Violet', value: '#8B5CF6' },
    { label: 'Emeraude', value: '#10B981' },
    { label: 'Rose', value: '#F43F5E' },
    { label: 'Orange', value: '#F59E0B' },
    { label: 'Ardoise', value: '#64748B' },
];