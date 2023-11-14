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
    path: 'qr-share',
    loadChildren: () => import('./qr-share/qr-share.module').then( m => m.QrSharePageModule)
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
    path: 'qrcode-gen',
    loadChildren: () => import('./qrcode-gen/qrcode-gen.module').then( m => m.QrcodeGenPageModule)
  },
  {
    path: 'wsclient',
    loadChildren: () => import('./wsclient/wsclient.module').then( m => m.WsclientPageModule)
  },
  {
    path: 'weblink-gen',
    loadChildren: () => import('./weblink-gen/weblink-gen.module').then( m => m.WeblinkGenPageModule)
  },
  {
    path: 'tts-export',
    loadChildren: () => import('./tts-export/tts-export.module').then( m => m.TtsExportPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsPageRoutingModule { }
