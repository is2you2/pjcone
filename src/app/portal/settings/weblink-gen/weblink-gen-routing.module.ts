import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WeblinkGenPage } from './weblink-gen.page';

const routes: Routes = [
  {
    path: '',
    component: WeblinkGenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WeblinkGenPageRoutingModule {}
