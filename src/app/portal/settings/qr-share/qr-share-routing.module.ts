import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { QrSharePage } from './qr-share.page';

const routes: Routes = [
  {
    path: '',
    component: QrSharePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QrSharePageRoutingModule {}
