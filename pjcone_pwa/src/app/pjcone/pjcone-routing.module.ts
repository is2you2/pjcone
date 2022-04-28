import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PjconePage } from './pjcone.page';

const routes: Routes = [
  {
    path: '',
    component: PjconePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PjconePageRoutingModule {}
