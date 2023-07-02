import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminToolsPage } from './admin-tools.page';

const routes: Routes = [
  {
    path: '',
    component: AdminToolsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminToolsPageRoutingModule {}
