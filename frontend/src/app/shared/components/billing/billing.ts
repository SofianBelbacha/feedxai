// frontend/src/app/features/dashboard/billing/billing.ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from './billing.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly userService     = inject(UserService);
  private readonly route   = inject(ActivatedRoute);

  loading        = signal(false);
  portalLoading  = signal(false);
  successMessage = signal('');
  errorMessage   = signal('');

  user        = this.userService.profile;
  currentPlan = computed(() => this.user()?.plan ?? 'Free');
  isPro       = computed(() => ['Pro', 'Team'].includes(this.currentPlan()));
  isTeam      = computed(() => this.currentPlan() === 'Team');

  readonly plans = [
    {
      id: 'free',
      name: 'Free',
      price: '0€',
      period: '',
      description: 'Pour tester la plateforme avec un premier client.',
      features: [
        '1 projet actif',
        '50 feedbacks / mois',
        'Analyse IA basique',
        'Kanban & filtres',
      ],
      priceId: null,
      highlight: false,
      cta: 'Plan actuel',
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '9€',
      period: '/ mois',
      description: 'Pour les freelances et agences actives.',
      features: [
        '10 projets actifs',
        'Feedbacks illimités',
        'Analyse IA avancée (score, sentiment, topics)',
        'Export CSV',
        'Graphique de tendances 30 jours',
      ],
      priceId: 'price_PRO_ID', // ← remplacer par votre vrai Price ID Stripe
      highlight: true,
      cta: 'Passer au Pro',
    },
    {
      id: 'team',
      name: 'Team',
      price: '29€',
      period: '/ mois',
      description: 'Pour les agences qui travaillent à plusieurs.',
      features: [
        'Tout le plan Pro',
        'Membres illimités par projet',
        'Rôles et permissions',
        'Support prioritaire',
      ],
      priceId: 'price_TEAM_ID', // ← remplacer par votre vrai Price ID Stripe
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

  upgrade(priceId: string | null): void {
    if (!priceId || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');

    this.billing.createCheckoutSession(priceId).subscribe({
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
}