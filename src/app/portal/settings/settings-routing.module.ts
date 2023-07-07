import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SettingsPage } from './settings.page';

const routes: Routes = [
  {
    path: '',
    component: SettingsPage
  },
  {
    path: 'licenses',
    loadChildren: () => import('./licenses/licenses.module').then( m => m.LicensesPageModule)
  },
  {
    path: 'profile',
    loadChildren: () => import('./profile/profile.module').then( m => m.ProfilePageModule)
  },
  {
    path: 'dedicated-settings',
    loadChildren: () => import('./dedicated-settings/dedicated-settings.module').then( m => m.DedicatedSettingsPageModule)
  },
  {
    path: 'group-server',
    loadChildren: () => import('./group-server/group-server.module').then( m => m.GroupServerPageModule)
  },
  {
    path: 'add-group',
    loadChildren: () => import('./add-group/add-group.module').then( m => m.AddGroupPageModule)
  },
  {
    path: 'group-detail',
    loadChildren: () => import('./group-detail/group-detail.module').then( m => m.GroupDetailPageModule)
  },
  {
    path: 'translator',
    loadChildren: () => import('./translator/translator.module').then( m => m.TranslatorPageModule)
  },
  {
    path: 'creator',
    loadChildren: () => import('./creator/creator.module').then( m => m.CreatorPageModule)
  },
  {
    path: 'tool-management',
    loadChildren: () => import('./tool-management/tool-management.module').then( m => m.ToolManagementPageModule)
  },
  {
    path: 'qr-share',
    loadChildren: () => import('./qr-share/qr-share.module').then( m => m.QrSharePageModule)
  },
  {
    path: 'noti-alert',
    loadChildren: () => import('./noti-alert/noti-alert.module').then( m => m.NotiAlertPageModule)
  },
  {
    path: 'engineppt',
    loadChildren: () => import('./engineppt/engineppt.module').then( m => m.EnginepptPageModule)
  },
  {
    path: 'admin-tools',
    loadChildren: () => import('./admin-tools/admin-tools.module').then( m => m.AdminToolsPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsPageRoutingModule { }
