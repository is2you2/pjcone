import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SendActPage } from './send-act.page';

const routes: Routes = [
  {
    path: '',
    component: SendActPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SendActPageRoutingModule {}
