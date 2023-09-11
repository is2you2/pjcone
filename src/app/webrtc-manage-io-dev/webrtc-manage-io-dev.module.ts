import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WebrtcManageIoDevPageRoutingModule } from './webrtc-manage-io-dev-routing.module';

import { WebrtcManageIoDevPage } from './webrtc-manage-io-dev.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WebrtcManageIoDevPageRoutingModule
  ],
  declarations: [WebrtcManageIoDevPage]
})
export class WebrtcManageIoDevPageModule {}
