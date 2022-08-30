import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SubscribesPage } from './subscribes.page';

const routes: Routes = [
  {
    path: '',
    component: SubscribesPage
  },
  {
    path: 'chat-room',
    loadChildren: () => import('./chat-room/chat-room.module').then( m => m.ChatRoomPageModule)
  },
  {
    path: 'task-info',
    loadChildren: () => import('./task-info/task-info.module').then( m => m.TaskInfoPageModule)
  },
  {
    path: 'projinfo',
    loadChildren: () => import('./projinfo/projinfo.module').then( m => m.ProjinfoPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SubscribesPageRoutingModule {}
