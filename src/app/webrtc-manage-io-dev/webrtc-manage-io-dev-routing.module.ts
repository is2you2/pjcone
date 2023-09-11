import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WebrtcManageIoDevPage } from './webrtc-manage-io-dev.page';

const routes: Routes = [
  {
    path: '',
    component: WebrtcManageIoDevPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WebrtcManageIoDevPageRoutingModule {}
