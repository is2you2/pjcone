import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NotiAlertPage } from './noti-alert.page';

const routes: Routes = [
  {
    path: '',
    component: NotiAlertPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NotiAlertPageRoutingModule {}
