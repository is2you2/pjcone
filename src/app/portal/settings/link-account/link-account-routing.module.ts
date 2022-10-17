import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LinkAccountPage } from './link-account.page';

const routes: Routes = [
  {
    path: '',
    component: LinkAccountPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LinkAccountPageRoutingModule {}
