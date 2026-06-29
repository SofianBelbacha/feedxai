import { Component, ElementRef, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface MegaMenuColumn {
  title: string;
  links: { label: string; description: string; path: string; icon: string }[];
}
 
export interface NavItem {
  label: string;
  path?: string;
  megaMenu?: MegaMenuColumn[];
}

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnDestroy {
  private el = inject(ElementRef);

  // ── État scroll ────────────────────────────────────────
  scrolled = signal(false);
  scrollY = signal(0);

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY.set(window.scrollY);
    this.scrolled.set(window.scrollY > 24);
    // Ferme les mega-menus au scroll
    if (window.scrollY > 24) this.activeMenu.set(null);
  }

  // ── Mega-menus ─────────────────────────────────────────
  activeMenu = signal<string | null>(null);

  openMenu(label: string): void { this.activeMenu.set(label); }
  closeMenu(): void { this.activeMenu.set(null); }
  toggleMenu(label: string): void {
    this.activeMenu.update(v => v === label ? null : label);
  }

  // Ferme si clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target)) {
      this.activeMenu.set(null);
    }
  }

  // ── Drawer mobile ──────────────────────────────────────
  drawerOpen = signal(false);
  drawerSection = signal<string | null>(null);

  openDrawer(): void {
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.drawerSection.set(null);
    document.body.style.overflow = '';
  }

  toggleDrawerSection(label: string): void {
    this.drawerSection.update(v => v === label ? null : label);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  // ── Données de navigation ──────────────────────────────
  navItems: NavItem[] = [
    {
      label: 'Produit',
      megaMenu: [
        {
          title: 'Fonctionnalités',
          links: [
            { label: 'Analyse IA', description: 'Catégorisation et priorisation automatique', path: '/features/ai', icon: 'brain' },
            { label: 'Kanban', description: 'Visualisez et gérez vos retours clients', path: '/features/kanban', icon: 'kanban' },
            { label: 'Widget client', description: 'Formulaire intégrable en 2 minutes', path: '/features/widget', icon: 'code' },
            { label: 'Tendances', description: 'Graphiques et insights sur 30 jours', path: '/features/trends', icon: 'chart' },
          ],
        },
        {
          title: 'Gestion',
          links: [
            { label: 'Multi-projets', description: 'Centralisez tous vos clients en un endroit', path: '/features/projects', icon: 'folder' },
            { label: 'Équipe', description: 'Invitez et collaborez avec vos collègues', path: '/features/team', icon: 'users' },
            { label: 'Intégrations', description: 'Slack, Notion, Zapier et plus encore', path: '/integrations', icon: 'plug' },
          ],
        },
      ],
    },
    {
      label: 'Solutions',
      megaMenu: [
        {
          title: 'Par profil',
          links: [
            { label: 'Agences web', description: 'Gérez les retours de plusieurs clients', path: '/solutions/agencies', icon: 'building' },
            { label: 'Freelances', description: 'Un outil léger adapté aux indépendants', path: '/solutions/freelancers', icon: 'user' },
            { label: 'Équipes IT', description: 'Triez les bugs des demandes de features', path: '/solutions/it-teams', icon: 'code' },
          ],
        },
        {
          title: 'Par besoin',
          links: [
            { label: 'Recettage client', description: 'Structurez la phase de validation', path: '/solutions/uat', icon: 'check' },
            { label: 'Support produit', description: 'Centralisez les tickets utilisateurs', path: '/solutions/support', icon: 'headset' },
          ],
        },
      ],
    },
    {
      label: 'Ressources',
      megaMenu: [
        {
          title: 'Apprendre',
          links: [
            { label: 'Blog', description: 'Conseils et bonnes pratiques', path: '/blog', icon: 'edit' },
            { label: 'Documentation', description: 'Guides techniques et API', path: '/docs', icon: 'book' },
            { label: 'Roadmap', description: 'Nos prochaines fonctionnalités', path: '/roadmap', icon: 'map' },
          ],
        },
        {
          title: 'Aide',
          links: [
            { label: 'Centre d\'aide', description: 'FAQ et support', path: '/help', icon: 'lifering' },
            { label: 'Nous contacter', description: 'Parlez à un humain', path: '/contact', icon: 'mail' },
          ],
        },
      ],
    },
    {
      label: 'Tarifs',
      path: '/pricing',
    },
  ];
}
