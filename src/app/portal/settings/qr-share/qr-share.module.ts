import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { QrSharePageRoutingModule } from './qr-share-routing.module';

import { QrSharePage } from './qr-share.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QrSharePageRoutingModule
  ],
  declarations: [QrSharePage]
})
export class QrSharePageModule {}
