import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NotiAlertPageRoutingModule } from './noti-alert-routing.module';

import { NotiAlertPage } from './noti-alert.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NotiAlertPageRoutingModule
  ],
  declarations: [NotiAlertPage]
})
export class NotiAlertPageModule {}
