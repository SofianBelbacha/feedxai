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
      description: 'Pour découvrir la plateforme avec un premier client.',
      cta: 'Commencer gratuitement',
      ctaPath: '/register',
      featured: false,
      features: [
        '1 projet actif',
        '50 feedbacks / mois',
        'Analyse IA : catégorie + résumé',
        'Tableau kanban',
        'Widget intégrable',
        'Documentation & communauté',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 9,
      description: 'Pour les freelances qui gèrent plusieurs clients en parallèle.',
      cta: 'Passer au Pro',
      ctaPath: '/register?plan=pro',
      featured: true,
      features: [
        '10 projets actifs',
        "Jusqu'à 2 000 feedbacks / mois",
        'Analyse IA complète : score de priorité, sentiment, topics',
        'Filtres avancés & tri par priorité',
        'Widget personnalisable (couleurs, texte, position)',
        'Graphique de tendances 30 jours',
        'Export CSV',
        'Réponse support sous 24h',
      ],
    },
    {
      id: 'team',
      name: 'Team',
      price: 29,
      description: 'Pour les agences qui livrent des projets à plusieurs.',
      cta: 'Passer au Team',
      ctaPath: '/register?plan=team',
      featured: false,
      features: [
        'Projets illimités',
        "Jusqu'à 10 000 feedbacks / mois",
        'Tout le plan Pro',
        "Membres d'équipe illimités",
        'Gestion des rôles & permissions',
        'Tableau de bord partagé',
        'Réponse support sous 4h',
      ],
    },
  ];
}


