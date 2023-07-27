import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WsclientPage } from './wsclient.page';

const routes: Routes = [
  {
    path: '',
    component: WsclientPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WsclientPageRoutingModule {}
