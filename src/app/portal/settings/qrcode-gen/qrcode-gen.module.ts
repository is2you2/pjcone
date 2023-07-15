import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { QrcodeGenPageRoutingModule } from './qrcode-gen-routing.module';

import { QrcodeGenPage } from './qrcode-gen.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QrcodeGenPageRoutingModule
  ],
  declarations: [QrcodeGenPage]
})
export class QrcodeGenPageModule {}
