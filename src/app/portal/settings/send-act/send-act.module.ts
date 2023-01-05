import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SendActPageRoutingModule } from './send-act-routing.module';

import { SendActPage } from './send-act.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SendActPageRoutingModule
  ],
  declarations: [SendActPage]
})
export class SendActPageModule {}
