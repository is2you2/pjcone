import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GroupServerPage } from './group-server.page';

const routes: Routes = [
  {
    path: '',
    component: GroupServerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GroupServerPageRoutingModule {}
