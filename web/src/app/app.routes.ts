import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.component').then((m) => m.LoginComponent),
    title: 'OCS Console · Entrar',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard.component').then((m) => m.DashboardComponent),
    title: 'OCS Console · Dashboard',
  },
  {
    path: 'ativos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/computer-list.component').then((m) => m.ComputerListComponent),
    title: 'OCS Console · Ativos',
  },
  {
    path: 'software',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/software.component').then((m) => m.SoftwareComponent),
    title: 'OCS Console · Software',
  },
  {
    path: 'relatorios',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/reports.component').then((m) => m.ReportsComponent),
    title: 'OCS Console · Relatórios',
  },
  {
    path: 'itsm',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/itsm.component').then((m) => m.ItsmComponent),
    title: 'OCS Console · ITSM / Documentação',
  },
  {
    path: 'servidor',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/servidor.component').then((m) => m.ServidorComponent),
    title: 'OCS Console · Servidor',
  },
  {
    path: 'sqlserver',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/sqlserver-report.component').then((m) => m.SqlServerReportComponent),
    title: 'OCS Console · SQL Server',
  },
  {
    path: 'updates',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/update-report.component').then((m) => m.UpdateReportComponent),
    title: 'OCS Console · Atualizações',
  },
  {
    path: 'computer/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/computer-detail.component').then((m) => m.ComputerDetailComponent),
    title: 'OCS Console · Máquina',
  },
  { path: '**', redirectTo: '' },
];
