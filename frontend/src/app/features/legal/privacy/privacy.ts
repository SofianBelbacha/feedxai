import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface PrivacySection {
  id: string;
  title: string;
  content: (string | { type: 'list'; items: string[] })[];
} 

@Component({
  selector: 'app-privacy',
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy.html',
  styleUrl: './privacy.scss',
})
export class Privacy {

  lastUpdated = '28 mai 2026';
  activeSection = '';

  sections: PrivacySection[] = [
    {
      id: 'intro',
      title: 'Introduction',
      content: [
        'Chez AI Review Hub, la protection de vos données personnelles est une priorité. Cette politique de confidentialité décrit quelles données nous collectons, pourquoi nous les collectons, comment nous les utilisons et quels droits vous avez sur celles-ci.',
        'Elle s\'applique à toutes les personnes utilisant notre plateforme, qu\'elles soient utilisateurs finaux (créateurs de projets) ou clients finaux (personnes soumettant des feedbacks via le widget).',
      ],
    },
    {
      id: 'controller',
      title: 'Responsable du traitement',
      content: [
        'Le responsable du traitement des données personnelles collectées via AI Review Hub est :',
        'AI Review Hub — contact : privacy@ai-review-hub.app',
        'Pour toute question relative à vos données, vous pouvez nous contacter à cette adresse.',
      ],
    },
    {
      id: 'data-collected',
      title: 'Données collectées',
      content: [
        'Nous collectons uniquement les données nécessaires au fonctionnement du service. Voici les catégories de données traitées :',
        {
          type: 'list',
          items: [
            'Données de compte : adresse email, mot de passe (haché), prénom/nom optionnel, plan souscrit.',
            'Données de facturation : adresse de facturation, historique de paiements. Les données de carte bancaire sont gérées exclusivement par Stripe.',
            'Données de projets et feedbacks : noms de projets, contenus des feedbacks soumis par vos clients via le widget.',
            'Données d\'analyse IA : les feedbacks sont transmis à l\'API OpenAI pour analyse (catégorisation, résumé, score de priorité).',
            'Données techniques : adresse IP, type de navigateur, pages visitées, durée des sessions — collectées via nos logs serveur.',
          ],
        },
        'Nous ne collectons pas de données sensibles au sens du RGPD (origine raciale, données de santé, opinions politiques, etc.).',
      ],
    },
    {
      id: 'purposes',
      title: 'Finalités du traitement',
      content: [
        'Vos données sont traitées pour les finalités suivantes :',
        {
          type: 'list',
          items: [
            'Fourniture du service : création et gestion de compte, accès aux fonctionnalités selon votre plan.',
            'Analyse IA des feedbacks : transmission à l\'API OpenAI pour catégorisation et priorisation automatique.',
            'Facturation et paiements : gestion de votre abonnement via Stripe.',
            'Support client : réponse à vos demandes et résolution de problèmes techniques.',
            'Amélioration du service : analyse agrégée et anonymisée de l\'usage de la plateforme.',
            'Communication légale : envoi du reçu de paiement, notifications de changement de conditions.',
          ],
        },
        'Nous n\'utilisons pas vos données à des fins de publicité ciblée et nous ne revendons jamais vos données à des tiers.',
      ],
    },
    {
      id: 'legal-basis',
      title: 'Base légale du traitement',
      content: [
        'Chaque traitement repose sur l\'une des bases légales suivantes prévues par le RGPD :',
        {
          type: 'list',
          items: [
            'Exécution du contrat : traitement nécessaire à la fourniture du service (compte, feedbacks, facturation).',
            'Intérêt légitime : amélioration du service, sécurité de la plateforme, logs techniques.',
            'Consentement : communications marketing optionnelles (vous pouvez vous désabonner à tout moment).',
            'Obligation légale : conservation de certaines données comptables conformément à la réglementation française.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      title: 'Durée de conservation',
      content: [
        'Nous appliquons des durées de conservation strictement proportionnées aux finalités du traitement :',
        {
          type: 'list',
          items: [
            'Données de compte : conservées pendant toute la durée de votre abonnement, puis 30 jours après la clôture du compte avant suppression définitive.',
            'Données de feedbacks et projets : supprimées immédiatement à votre demande ou 30 jours après la clôture du compte.',
            'Données de facturation : conservées 10 ans conformément aux obligations comptables légales.',
            'Logs techniques : conservés 12 mois à des fins de sécurité et de débogage.',
          ],
        },
      ],
    },
    {
      id: 'openai',
      title: 'Transfert à OpenAI',
      content: [
        'Pour l\'analyse automatique des feedbacks, le contenu textuel des retours clients est transmis à l\'API OpenAI. Ce transfert est encadré par les conditions d\'utilisation et la politique de confidentialité d\'OpenAI.',
        'OpenAI ne conserve pas les données transmises via l\'API au-delà de la durée nécessaire à la génération de la réponse (politique de rétention zéro pour les clients API). Les données ne sont pas utilisées pour entraîner les modèles OpenAI.',
        'Si vous souhaitez que certains projets ne bénéficient pas de l\'analyse IA, vous pouvez désactiver cette fonctionnalité depuis les paramètres du projet concerné.',
      ],
    },
    {
      id: 'subprocessors',
      title: 'Sous-traitants',
      content: [
        'Nous faisons appel aux sous-traitants suivants pour opérer notre service :',
        {
          type: 'list',
          items: [
            'Stripe (Stripe Inc., USA) — paiement et facturation. Certifié PCI DSS niveau 1.',
            'OpenAI (OpenAI LLC, USA) — analyse IA des feedbacks via l\'API.',
            'Railway / Supabase — hébergement de la base de données PostgreSQL (Union Européenne ou USA selon la configuration).',
            'Postmark — envoi des emails transactionnels (reçus, notifications).',
          ],
        },
        'Tous nos sous-traitants sont liés par des accords de traitement des données conformes au RGPD. Les transferts hors UE sont encadrés par des clauses contractuelles types approuvées par la Commission européenne.',
      ],
    },
    {
      id: 'rights',
      title: 'Vos droits',
      content: [
        'Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :',
        {
          type: 'list',
          items: [
            'Droit d\'accès : obtenir une copie de vos données personnelles que nous traitons.',
            'Droit de rectification : corriger des données inexactes ou incomplètes.',
            'Droit à l\'effacement : demander la suppression de vos données (sous réserve des obligations légales de conservation).',
            'Droit à la portabilité : recevoir vos données dans un format structuré et lisible par machine.',
            'Droit d\'opposition : vous opposer à certains traitements fondés sur notre intérêt légitime.',
            'Droit à la limitation : demander la suspension temporaire d\'un traitement.',
          ],
        },
        'Pour exercer vos droits, contactez-nous à privacy@ai-review-hub.app. Nous répondons dans un délai de 30 jours. Vous avez également le droit d\'introduire une réclamation auprès de la CNIL (Commission Nationale de l\'Informatique et des Libertés).',
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies et traceurs',
      content: [
        'AI Review Hub utilise des cookies strictement nécessaires au fonctionnement de la plateforme (session, authentification JWT). Aucun cookie publicitaire ou de tracking tiers n\'est utilisé.',
        'Les cookies de session expirent à la fermeture de votre navigateur. Le token JWT d\'authentification est stocké de manière sécurisée et expire après 7 jours d\'inactivité.',
      ],
    },
    {
      id: 'security',
      title: 'Sécurité',
      content: [
        'Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :',
        {
          type: 'list',
          items: [
            'Chiffrement des communications via HTTPS/TLS.',
            'Mots de passe hachés avec bcrypt (facteur de coût adaptatif).',
            'Authentification par JWT avec refresh tokens sécurisés.',
            'Accès à la base de données restreint et audité.',
            'Sauvegardes chiffrées quotidiennes.',
          ],
        },
        'En cas de violation de données susceptible d\'engendrer un risque pour vos droits et libertés, nous nous engageons à vous notifier dans les 72 heures conformément à l\'article 33 du RGPD.',
      ],
    },
    {
      id: 'changes',
      title: 'Modifications de cette politique',
      content: [
        'Nous pouvons mettre à jour cette politique de confidentialité pour refléter des changements dans nos pratiques ou pour des raisons légales, réglementaires ou opérationnelles.',
        'En cas de modification substantielle, nous vous informerons par email au moins 30 jours avant l\'entrée en vigueur des nouvelles conditions. La date de dernière mise à jour est toujours indiquée en haut de cette page.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      content: [
        'Pour toute question relative à cette politique de confidentialité ou à l\'exercice de vos droits :',
        'Email : privacy@ai-review-hub.app',
        'Vous pouvez également nous contacter via le formulaire disponible dans votre espace compte ou à l\'adresse : support@ai-review-hub.app',
        'Autorité de contrôle : Commission Nationale de l\'Informatique et des Libertés (CNIL) — www.cnil.fr',
      ],
    },
  ];

  scrollTo(id: string): void {
    this.activeSection = id;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  isString(item: unknown): item is string {
    return typeof item === 'string';
  }

  isList(item: unknown): item is { type: 'list'; items: string[] } {
    return typeof item === 'object' && item !== null && (item as { type: string }).type === 'list';
  }
}
