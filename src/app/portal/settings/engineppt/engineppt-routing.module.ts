import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EnginepptPage } from './engineppt.page';

const routes: Routes = [
  {
    path: '',
    component: EnginepptPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EnginepptPageRoutingModule {}
