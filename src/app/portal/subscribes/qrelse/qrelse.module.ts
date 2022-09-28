import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { QRelsePageRoutingModule } from './qrelse-routing.module';

import { QRelsePage } from './qrelse.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    QRelsePageRoutingModule
  ],
  declarations: [QRelsePage]
})
export class QRelsePageModule {}
