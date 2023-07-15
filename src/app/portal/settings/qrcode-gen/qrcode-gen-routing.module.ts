import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { QrcodeGenPage } from './qrcode-gen.page';

const routes: Routes = [
  {
    path: '',
    component: QrcodeGenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QrcodeGenPageRoutingModule {}
