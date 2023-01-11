import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MinimalChatPage } from './minimal-chat.page';

const routes: Routes = [
  {
    path: '',
    component: MinimalChatPage
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
export class MinimalChatPageRoutingModule {}
