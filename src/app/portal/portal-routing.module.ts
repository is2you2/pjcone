import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PortalPage } from './portal.page';

const routes: Routes = [
  {
    path: '',
    component: PortalPage,
    children: [
      {
        path: '',
        redirectTo: 'subscribes',
        pathMatch: 'full',
      },
      {
        path: 'subscribes',
        loadChildren: () => import('./subscribes/subscribes.module').then(m => m.SubscribesPageModule)
      },
      {
        path: 'main',
        loadChildren: () => import('./main/main.module').then(m => m.MainPageModule)
      },
      {
        path: 'community',
        loadChildren: () => import('./community/community.module').then(m => m.CommunityPageModule)
      },
      {
        path: 'arcade',
        loadChildren: () => import('./arcade/arcade.module').then(m => m.ArcadePageModule)
      }
    ],
  },
  {
    path: 'settings',
    loadChildren: () => import('./settings/settings.module').then(m => m.SettingsPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PortalPageRoutingModule { }
