import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReqCounterPageRoutingModule } from './req-counter-routing.module';

import { ReqCounterPage } from './req-counter.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReqCounterPageRoutingModule
  ],
  declarations: [ReqCounterPage]
})
export class ReqCounterPageModule {}
