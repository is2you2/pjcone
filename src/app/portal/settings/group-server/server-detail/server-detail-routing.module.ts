import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ServerDetailPage } from './server-detail.page';

const routes: Routes = [
  {
    path: '',
    component: ServerDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ServerDetailPageRoutingModule {}
