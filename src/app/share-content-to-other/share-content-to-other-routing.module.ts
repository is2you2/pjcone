import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ShareContentToOtherPage } from './share-content-to-other.page';

const routes: Routes = [
  {
    path: '',
    component: ShareContentToOtherPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ShareContentToOtherPageRoutingModule {}
