import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ShareContentToOtherPageRoutingModule } from './share-content-to-other-routing.module';

import { ShareContentToOtherPage } from './share-content-to-other.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ShareContentToOtherPageRoutingModule
  ],
  declarations: [ShareContentToOtherPage]
})
export class ShareContentToOtherPageModule {}
