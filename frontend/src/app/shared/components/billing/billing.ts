import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BillingService } from './billing.service';
import { UserService } from '../../../core/services/user.service';
import { environment } from '../../../../environments/environment';

type PaidPlanId = 'pro' | 'team';

type PricingPlan = {
  id: 'free' | PaidPlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  priceId: string | null;
  highlight: boolean;
  cta: string;
};

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);

  loading = signal(false);
  portalLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  user = this.userService.profile;
  currentPlan = computed(() => this.user()?.plan ?? 'Free');
  isPro = computed(() => ['Pro', 'Team'].includes(this.currentPlan()));
  isTeam = computed(() => this.currentPlan() === 'Team');

  readonly plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: '0€',
      period: '',
      description: 'Pour tester la plateforme avec un premier client.',
      features: [
        '1 projet actif',
        '50 feedbacks / mois',
        'Analyse IA : catégorie + résumé',
        'Tableau kanban',
        'Widget intégrable',
        'Documentation & communauté',
      ],
      priceId: null,
      highlight: false,
      cta: 'Plan actuel',
    },
    {
      id: 'pro' as 'pro' | 'team',
      name: 'Pro',
      price: '9€',
      period: '/ mois',
      description: 'Pour les freelances et agences actives.',
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
      priceId: environment.stripePrices.pro,
      highlight: true,
      cta: 'Passer au Pro',
    },
    {
      id: 'team' as 'pro' | 'team',
      name: 'Team',
      price: '29€',
      period: '/ mois',
      description: 'Pour les agences qui travaillent à plusieurs.',
      features: [
        'Projets illimités',
        "Jusqu'à 10 000 feedbacks / mois",
        'Tout le plan Pro',
        "Membres d'équipe illimités",
        'Gestion des rôles & permissions',
        'Tableau de bord partagé',
        'Réponse support sous 4h',
      ],
      priceId: environment.stripePrices.team,
      highlight: false,
      cta: 'Passer au Team',
    },
  ];

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    if (queryParams.get('success') === 'true') {
      this.successMessage.set('🎉 Votre abonnement est actif ! Bienvenue sur le plan Pro.');
    } else if (queryParams.get('canceled') === 'true') {
      this.errorMessage.set('Le paiement a été annulé. Vous pouvez réessayer à tout moment.');
    }
  }

  upgrade(priceId: string | null, planId: 'pro' | 'team'): void {
    if (!priceId || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');

    this.billing.createCheckoutSession(priceId, planId).subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Erreur lors de la création de la session de paiement.');
      }
    });
  }

  openPortal(): void {
    if (this.portalLoading()) return;
    this.portalLoading.set(true);
    this.errorMessage.set('');

    this.billing.createBillingPortalSession().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => {
        this.portalLoading.set(false);
        this.errorMessage.set('Erreur lors de l\'ouverture du portail de facturation.');
      }
    });
  }

  isPlanActive(planId: string): boolean {
    return this.currentPlan().toLowerCase() === planId;
  }

  selectPlan(plan: PricingPlan): void {
    if (plan.id === 'free' || !plan.priceId) return;

    this.upgrade(plan.priceId, plan.id);
  }
}