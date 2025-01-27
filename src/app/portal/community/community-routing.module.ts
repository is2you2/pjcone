import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CommunityPage } from './community.page';

const routes: Routes = [
  {
    path: '',
    component: CommunityPage
  },
  {
    path: 'add-post',
    loadChildren: () => import('./add-post/add-post.module').then(m => m.AddPostPageModule)
  },
  {
    path: 'post-viewer',
    loadChildren: () => import('./post-viewer/post-viewer.module').then(m => m.PostViewerPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityPageRoutingModule { }
