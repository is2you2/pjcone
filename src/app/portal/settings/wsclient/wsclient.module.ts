import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WsclientPageRoutingModule } from './wsclient-routing.module';

import { WsclientPage } from './wsclient.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WsclientPageRoutingModule
  ],
  declarations: [WsclientPage]
})
export class WsclientPageModule {}
