import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LinkQrPage } from './link-qr.page';

const routes: Routes = [
  {
    path: '',
    component: LinkQrPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LinkQrPageRoutingModule {}
