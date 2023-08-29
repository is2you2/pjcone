import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { QuickShareReviewPage } from './quick-share-review.page';

const routes: Routes = [
  {
    path: '',
    component: QuickShareReviewPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QuickShareReviewPageRoutingModule {}
