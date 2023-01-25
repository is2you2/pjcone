import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChatRoomPage } from './chat-room.page';

const routes: Routes = [
  {
    path: '',
    component: ChatRoomPage
  },
  {
    path: 'ionic-viewer',
    loadChildren: () => import('./ionic-viewer/ionic-viewer.module').then( m => m.IonicViewerPageModule)
  },
  {
    path: 'godot-viewer',
    loadChildren: () => import('./godot-viewer/godot-viewer.module').then( m => m.GodotViewerPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatRoomPageRoutingModule {}
