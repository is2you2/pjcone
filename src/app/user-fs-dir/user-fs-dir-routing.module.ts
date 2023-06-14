import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UserFsDirPage } from './user-fs-dir.page';

const routes: Routes = [
  {
    path: '',
    component: UserFsDirPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UserFsDirPageRoutingModule {}
