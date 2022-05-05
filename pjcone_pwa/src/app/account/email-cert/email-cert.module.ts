import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EmailCertPageRoutingModule } from './email-cert-routing.module';

import { EmailCertPage } from './email-cert.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EmailCertPageRoutingModule
  ],
  declarations: [EmailCertPage]
})
export class EmailCertPageModule {}
