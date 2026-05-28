import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface TermsSection {
  id: string;
  title: string;
  content: string[];
}

@Component({
  selector: 'app-terms',
  imports: [CommonModule, RouterLink],
  templateUrl: './terms.html',
  styleUrl: './terms.scss',
})
export class Terms {
  lastUpdated = '28 mai 2026';

  sections: TermsSection[] = [
    {
      id: 'acceptance',
      title: 'Acceptation des conditions',
      content: [
        'En accédant à AI Review Hub et en utilisant nos services, vous acceptez d\'être lié par les présentes Conditions d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.',
        'Ces conditions s\'appliquent à tous les utilisateurs de la plateforme, qu\'ils soient en version gratuite (Free), professionnelle (Pro) ou en équipe (Team). Anthropic se réserve le droit de modifier ces conditions à tout moment, avec notification préalable par email.',
      ],
    },
    {
      id: 'description',
      title: 'Description du service',
      content: [
        'AI Review Hub est une plateforme SaaS qui permet aux équipes, freelances et agences web de centraliser, analyser et prioriser les retours clients grâce à l\'intelligence artificielle.',
        'Le service comprend notamment : la création de projets, la collecte de feedbacks via un widget intégrable, l\'analyse automatique par IA (catégorisation, résumé, score de priorité), un tableau de bord kanban et des graphiques de tendances.',
        'Nous nous réservons le droit de modifier, suspendre ou interrompre tout ou partie du service à tout moment, avec un préavis raisonnable sauf en cas d\'urgence technique ou de sécurité.',
      ],
    },
    {
      id: 'account',
      title: 'Création de compte et responsabilités',
      content: [
        'Pour utiliser AI Review Hub, vous devez créer un compte avec une adresse email valide et un mot de passe sécurisé. Vous êtes responsable de la confidentialité de vos identifiants et de toutes les activités effectuées depuis votre compte.',
        'Vous vous engagez à fournir des informations exactes et à maintenir vos informations de compte à jour. Tout accès non autorisé à votre compte doit être signalé immédiatement à notre équipe de support.',
        'Un compte est réservé à un usage personnel ou professionnel légitime. La création de comptes multiples pour contourner les limitations du plan gratuit est interdite.',
      ],
    },
    {
      id: 'plans',
      title: 'Plans et facturation',
      content: [
        'AI Review Hub propose trois plans : Free (gratuit, 1 projet, 50 feedbacks/mois), Pro (9€/mois, 10 projets, feedbacks illimités) et Team (29€/mois, projets et membres illimités).',
        'Les abonnements payants sont facturés mensuellement ou annuellement selon votre choix. Le paiement est effectué en début de période via nos prestataires de paiement sécurisés (Stripe). Aucune donnée de carte bancaire n\'est stockée sur nos serveurs.',
        'Vous pouvez annuler votre abonnement à tout moment depuis votre espace compte. L\'annulation prend effet à la fin de la période de facturation en cours. Aucun remboursement partiel n\'est effectué pour les périodes déjà facturées, sauf disposition légale contraire.',
        'En cas de non-paiement, votre compte sera rétrogradé vers le plan Free après une période de grâce de 7 jours, avec conservation de vos données pendant 30 jours supplémentaires.',
      ],
    },
    {
      id: 'usage',
      title: 'Utilisation acceptable',
      content: [
        'Vous vous engagez à utiliser AI Review Hub uniquement à des fins légales et conformes aux présentes conditions. Est notamment interdit : tout usage frauduleux, la diffusion de contenus illicites via le widget, toute tentative d\'accès non autorisé aux systèmes de la plateforme.',
        'Vous ne devez pas utiliser le service pour collecter des données personnelles sans le consentement des personnes concernées, ni pour envoyer des communications non sollicitées.',
        'Nous nous réservons le droit de suspendre ou supprimer tout compte en violation de ces règles, sans préavis et sans remboursement.',
      ],
    },
    {
      id: 'data',
      title: 'Données et confidentialité',
      content: [
        'Les données que vous saisissez dans AI Review Hub (projets, feedbacks, paramètres) vous appartiennent. Nous ne revendiquons aucun droit de propriété sur vos contenus.',
        'Vos données sont utilisées uniquement pour fournir le service. Les feedbacks soumis sont transmis à l\'API OpenAI pour analyse ; cette transmission est couverte par notre politique de confidentialité et les conditions d\'utilisation d\'OpenAI.',
        'Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, perte ou altération. Pour plus de détails, consultez notre Politique de confidentialité.',
      ],
    },
    {
      id: 'ip',
      title: 'Propriété intellectuelle',
      content: [
        'La plateforme AI Review Hub, son code source, son interface, ses marques et logos sont la propriété exclusive de leurs auteurs et sont protégés par les lois applicables en matière de propriété intellectuelle.',
        'Vous bénéficiez d\'un droit d\'utilisation limité, non exclusif et non transférable de la plateforme dans le cadre de votre abonnement. Toute reproduction, modification ou distribution non autorisée est interdite.',
      ],
    },
    {
      id: 'liability',
      title: 'Limitation de responsabilité',
      content: [
        'AI Review Hub est fourni "en l\'état". Nous ne garantissons pas un fonctionnement ininterrompu ou exempt d\'erreurs. Nous nous efforçons d\'atteindre une disponibilité de 99,5% mensuelle, hors maintenances planifiées.',
        'Dans les limites permises par la loi applicable, notre responsabilité totale envers vous ne saurait excéder le montant que vous avez payé pour le service au cours des 3 derniers mois précédant l\'événement donnant lieu à la réclamation.',
        'Nous ne sommes pas responsables des dommages indirects, accessoires ou consécutifs résultant de votre utilisation ou de votre impossibilité d\'utiliser le service.',
      ],
    },
    {
      id: 'termination',
      title: 'Résiliation',
      content: [
        'Vous pouvez résilier votre compte à tout moment depuis les paramètres de votre compte. Vos données seront conservées pendant 30 jours après la résiliation, puis supprimées définitivement.',
        'Nous pouvons résilier ou suspendre votre accès immédiatement en cas de violation des présentes conditions, sans préavis ni remboursement.',
      ],
    },
    {
      id: 'law',
      title: 'Droit applicable et litiges',
      content: [
        'Les présentes conditions sont régies par le droit français. En cas de litige, les parties s\'engagent à rechercher une solution amiable avant toute action judiciaire.',
        'À défaut d\'accord amiable, tout litige sera soumis à la compétence exclusive des tribunaux compétents du ressort de Paris, France.',
      ],
    },
    {
      id: 'contact',
      title: 'Nous contacter',
      content: [
        'Pour toute question relative aux présentes conditions d\'utilisation, vous pouvez nous contacter à l\'adresse suivante : legal@ai-review-hub.app',
        'Pour les questions relatives à votre compte ou au support technique, utilisez le formulaire de contact disponible dans votre espace compte ou à l\'adresse : support@ai-review-hub.app',
      ],
    },
  ];

  activeSection = '';

  scrollTo(id: string): void {
    this.activeSection = id;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

}
