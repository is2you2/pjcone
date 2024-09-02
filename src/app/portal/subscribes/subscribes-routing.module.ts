import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SubscribesPage } from './subscribes.page';

const routes: Routes = [
  {
    path: '',
    component: SubscribesPage
  },
  {
    path: 'instant-call',
    loadChildren: () => import('./instant-call/instant-call.module').then( m => m.InstantCallPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SubscribesPageRoutingModule {}
