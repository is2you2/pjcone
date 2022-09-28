import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { QRelsePage } from './qrelse.page';

const routes: Routes = [
  {
    path: '',
    component: QRelsePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QRelsePageRoutingModule {}
