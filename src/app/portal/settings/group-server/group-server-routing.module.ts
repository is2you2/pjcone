import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GroupServerPage } from './group-server.page';

const routes: Routes = [
  {
    path: '',
    component: GroupServerPage
  },
  {
    path: 'server-detail',
    loadChildren: () => import('./server-detail/server-detail.module').then( m => m.ServerDetailPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GroupServerPageRoutingModule {}
