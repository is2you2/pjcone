import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VoidDrawPage } from './void-draw.page';

const routes: Routes = [
  {
    path: '',
    component: VoidDrawPage
  },
  {
    path: 'link-qr',
    loadChildren: () => import('./link-qr/link-qr.module').then( m => m.LinkQrPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VoidDrawPageRoutingModule {}
