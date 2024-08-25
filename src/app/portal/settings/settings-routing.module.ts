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
    path: 'translator',
    loadChildren: () => import('./translator/translator.module').then( m => m.TranslatorPageModule)
  },
  {
    path: 'creator',
    loadChildren: () => import('./creator/creator.module').then( m => m.CreatorPageModule)
  },
  {
    path: 'noti-alert',
    loadChildren: () => import('./noti-alert/noti-alert.module').then( m => m.NotiAlertPageModule)
  },
  {
    path: 'admin-tools',
    loadChildren: () => import('./admin-tools/admin-tools.module').then( m => m.AdminToolsPageModule)
  },
  {
    path: 'weblink-gen',
    loadChildren: () => import('./weblink-gen/weblink-gen.module').then( m => m.WeblinkGenPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsPageRoutingModule { }
