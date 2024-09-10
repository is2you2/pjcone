import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InstantCallPageRoutingModule } from './instant-call-routing.module';

import { InstantCallPage } from './instant-call.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InstantCallPageRoutingModule
  ],
  declarations: [InstantCallPage]
})
export class InstantCallPageModule {}
