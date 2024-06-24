import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LinkQrPageRoutingModule } from './link-qr-routing.module';

import { LinkQrPage } from './link-qr.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LinkQrPageRoutingModule
  ],
  declarations: [LinkQrPage]
})
export class LinkQrPageModule {}
