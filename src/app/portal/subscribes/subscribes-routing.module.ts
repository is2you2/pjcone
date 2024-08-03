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
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SubscribesPageRoutingModule {}
