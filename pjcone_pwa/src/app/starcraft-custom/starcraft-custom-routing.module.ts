import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StarcraftCustomPage } from './starcraft-custom.page';

const routes: Routes = [
  {
    path: '',
    component: StarcraftCustomPage
  },
  {
    path: 'detail',
    loadChildren: () => import('./detail/detail.module').then( m => m.DetailPageModule)
  },
  {
    path: 'guestbook',
    loadChildren: () => import('./guestbook/guestbook.module').then( m => m.GuestbookPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StarcraftCustomPageRoutingModule {}
