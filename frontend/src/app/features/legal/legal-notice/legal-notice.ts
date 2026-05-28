import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface LegalBlock {
  id: string;
  title: string;
  rows: { label: string; value: string; link?: string }[];
}

@Component({
  selector: 'app-legal-notice',
  imports: [CommonModule, RouterLink],
  templateUrl: './legal-notice.html',
  styleUrl: './legal-notice.scss',
})
export class LegalNotice {

  lastUpdated = '28 mai 2026';
  activeSection = '';

  blocks: LegalBlock[] = [
    {
      id: 'editor',
      title: 'Éditeur du site',
      rows: [
        { label: 'Raison sociale', value: 'AI Review Hub' },
        { label: 'Forme juridique', value: 'Entreprise individuelle' },
        { label: 'Siège social', value: 'France' },
        { label: 'Email', value: 'contact@ai-review-hub.app', link: 'mailto:contact@ai-review-hub.app' },
        { label: 'Directeur de publication', value: 'Équipe AI Review Hub' },
      ],
    },
    {
      id: 'hosting',
      title: 'Hébergement',
      rows: [
        { label: 'Hébergeur backend', value: 'Railway (Railway Corp., 340 S Lemon Ave #4133, Walnut, CA 91789, USA)', link: 'https://railway.app' },
        { label: 'Hébergeur base de données', value: 'Supabase (Supabase Inc., USA)', link: 'https://supabase.com' },
        { label: 'Hébergeur frontend', value: 'Vercel (Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA)', link: 'https://vercel.com' },
      ],
    },
    {
      id: 'payment',
      title: 'Paiement',
      rows: [
        { label: 'Prestataire', value: 'Stripe (Stripe Inc., 185 Berry Street, Suite 550, San Francisco, CA 94107, USA)', link: 'https://stripe.com' },
        { label: 'Certification', value: 'PCI DSS niveau 1' },
      ],
    },
    {
      id: 'ai',
      title: 'Intelligence artificielle',
      rows: [
        { label: 'Fournisseur IA', value: 'OpenAI (OpenAI LLC, 3180 18th Street, San Francisco, CA 94110, USA)', link: 'https://openai.com' },
        { label: 'Utilisation', value: 'Analyse, catégorisation et résumé des feedbacks clients via l\'API OpenAI' },
      ],
    },
    {
      id: 'ip',
      title: 'Propriété intellectuelle',
      rows: [
        { label: 'Droits', value: 'L\'ensemble du contenu de ce site (textes, code, interface, logo) est protégé par le droit de la propriété intellectuelle.' },
        { label: 'Reproduction', value: 'Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.' },
      ],
    },
    {
      id: 'data',
      title: 'Données personnelles',
      rows: [
        { label: 'Responsable', value: 'AI Review Hub' },
        { label: 'Finalité', value: 'Fourniture du service, facturation, support' },
        { label: 'Droits', value: 'Accès, rectification, suppression, portabilité — contactez privacy@ai-review-hub.app', link: 'mailto:privacy@ai-review-hub.app' },
        { label: 'Autorité de contrôle', value: 'CNIL — www.cnil.fr', link: 'https://www.cnil.fr' },
        { label: 'Politique complète', value: 'Voir notre Politique de confidentialité', link: '/privacy' },
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      rows: [
        { label: 'Usage', value: 'Cookies strictement nécessaires au fonctionnement (session, authentification)' },
        { label: 'Publicité', value: 'Aucun cookie publicitaire ou de tracking tiers' },
      ],
    },
    {
      id: 'law',
      title: 'Droit applicable',
      rows: [
        { label: 'Loi applicable', value: 'Droit français' },
        { label: 'Juridiction', value: 'Tribunaux compétents de Paris, France' },
        { label: 'Médiation', value: 'En cas de litige, les parties privilégient une résolution amiable avant toute action judiciaire' },
      ],
    },
  ];

  scrollTo(id: string): void {
    this.activeSection = id;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  isInternalLink(link: string): boolean {
    return link.startsWith('/');
  }
}
