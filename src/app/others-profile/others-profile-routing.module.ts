import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { OthersProfilePage } from './others-profile.page';

const routes: Routes = [
  {
    path: '',
    component: OthersProfilePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OthersProfilePageRoutingModule {}
