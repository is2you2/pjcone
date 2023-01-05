import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReceiveActPageRoutingModule } from './receive-act-routing.module';

import { ReceiveActPage } from './receive-act.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReceiveActPageRoutingModule
  ],
  declarations: [ReceiveActPage]
})
export class ReceiveActPageModule {}
