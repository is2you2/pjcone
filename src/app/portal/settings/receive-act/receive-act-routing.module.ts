import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ReceiveActPage } from './receive-act.page';

const routes: Routes = [
  {
    path: '',
    component: ReceiveActPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReceiveActPageRoutingModule {}
