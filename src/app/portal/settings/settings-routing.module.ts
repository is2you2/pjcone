import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SettingsPage } from './settings.page';

const routes: Routes = [
  {
    path: '',
    component: SettingsPage
  },
  {
    path: 'privacy',
    loadChildren: () => import('./privacy/privacy.module').then(m => m.PrivacyPageModule)
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
    path: 'community-server',
    loadChildren: () => import('./community-server/community-server.module').then( m => m.CommunityServerPageModule)
  },
  {
    path: 'add-group',
    loadChildren: () => import('./add-group/add-group.module').then( m => m.AddGroupPageModule)
  },
  {
    path: 'group-detail',
    loadChildren: () => import('./group-detail/group-detail.module').then( m => m.GroupDetailPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsPageRoutingModule { }
