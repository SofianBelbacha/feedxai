import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface PricingPlan {
  id: string;
  name: string;
  price: number | null;
  priceLabel?: string;
  description: string;
  cta: string;
  ctaPath: string;
  featured: boolean;
  features: string[];
}

@Component({
  selector: 'app-pricing',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {

  plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      description: 'Pour tester la valeur du produit sans engagement.',
      cta: 'Commencer gratuitement',
      ctaPath: '/register',
      featured: false,
      features: [
        '1 projet actif',
        '50 feedbacks / mois',
        'Analyse IA (catégorie + résumé)',
        'Tableau kanban',
        'Widget intégrable',
        'Support par email',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 9,
      description: 'Pour les freelances et indépendants qui gèrent plusieurs clients.',
      cta: 'Passer au Pro',
      ctaPath: '/register?plan=pro',
      featured: true,
      features: [
        '10 projets actifs',
        'Feedbacks illimités',
        'Analyse IA complète + score de priorité',
        'Tableau kanban + filtres avancés',
        'Widget intégrable personnalisable',
        'Graphique de tendances 30 jours',
        'Export CSV',
        'Support prioritaire',
      ],
    },
    {
      id: 'team',
      name: 'Team',
      price: 29,
      description: 'Pour les agences qui travaillent en équipe sur les mêmes projets.',
      cta: 'Contacter l\'équipe',
      ctaPath: '/contact',
      featured: false,
      features: [
        'Projets illimités',
        'Feedbacks illimités',
        'Tout le plan Pro',
        'Membres d\'équipe illimités',
        'Gestion des rôles & permissions',
        'Tableau de bord partagé',
        'Intégrations (Slack, Notion…)',
        'Support dédié + onboarding',
      ],
    },
  ];
}


