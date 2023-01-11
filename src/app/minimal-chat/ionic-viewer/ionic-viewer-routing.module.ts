import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { IonicViewerPage } from './ionic-viewer.page';

const routes: Routes = [
  {
    path: '',
    component: IonicViewerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IonicViewerPageRoutingModule {}
