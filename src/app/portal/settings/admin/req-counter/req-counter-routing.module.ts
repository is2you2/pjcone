import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ReqCounterPage } from './req-counter.page';

const routes: Routes = [
  {
    path: '',
    component: ReqCounterPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReqCounterPageRoutingModule {}
