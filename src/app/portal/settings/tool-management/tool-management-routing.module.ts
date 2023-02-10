import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ToolManagementPage } from './tool-management.page';

const routes: Routes = [
  {
    path: '',
    component: ToolManagementPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ToolManagementPageRoutingModule {}
