import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProjinfoPage } from './projinfo.page';

const routes: Routes = [
  {
    path: '',
    component: ProjinfoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProjinfoPageRoutingModule {}
