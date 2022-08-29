import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TaskInfoPage } from './task-info.page';

const routes: Routes = [
  {
    path: '',
    component: TaskInfoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TaskInfoPageRoutingModule {}
