import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ContentInfoPage } from './content-info.page';

const routes: Routes = [
  {
    path: '',
    component: ContentInfoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContentInfoPageRoutingModule {}
