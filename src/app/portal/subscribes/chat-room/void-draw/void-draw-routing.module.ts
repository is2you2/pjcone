import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VoidDrawPage } from './void-draw.page';

const routes: Routes = [
  {
    path: '',
    component: VoidDrawPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VoidDrawPageRoutingModule {}
