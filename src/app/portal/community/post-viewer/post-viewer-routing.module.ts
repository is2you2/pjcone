import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PostViewerPage } from './post-viewer.page';

const routes: Routes = [
  {
    path: '',
    component: PostViewerPage
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
export class PostViewerPageRoutingModule { }
