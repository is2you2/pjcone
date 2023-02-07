import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AddTodoMenuPage } from './add-todo-menu.page';

const routes: Routes = [
  {
    path: '',
    component: AddTodoMenuPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AddTodoMenuPageRoutingModule {}
