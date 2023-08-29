import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { QuickShareReviewPageRoutingModule } from './quick-share-review-routing.module';

import { QuickShareReviewPage } from './quick-share-review.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QuickShareReviewPageRoutingModule
  ],
  declarations: [QuickShareReviewPage]
})
export class QuickShareReviewPageModule {}
