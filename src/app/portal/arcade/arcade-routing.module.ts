import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ArcadePage } from './arcade.page';

const routes: Routes = [
  {
    path: '',
    component: ArcadePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArcadePageRoutingModule {}
