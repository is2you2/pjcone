import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { StarcraftCustomPage } from './starcraft-custom.page';

const routes: Routes = [
  {
    path: '',
    component: StarcraftCustomPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StarcraftCustomPageRoutingModule {}
