import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AddTodoMenuPage } from './add-todo-menu.page';

const routes: Routes = [
  {
    path: '',
    component: AddTodoMenuPage
  },
  {
    path: 'void-draw',
    loadChildren: () => import('../../subscribes/chat-room/void-draw/void-draw.module').then(m => m.VoidDrawPageModule)
  },
  {
    path: 'ionic-viewer',
    loadChildren: () => import('../../subscribes/chat-room/ionic-viewer/ionic-viewer.module').then(m => m.IonicViewerPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AddTodoMenuPageRoutingModule { }
