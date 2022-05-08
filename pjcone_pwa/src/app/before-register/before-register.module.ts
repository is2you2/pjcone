import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BeforeRegisterPageRoutingModule } from './before-register-routing.module';

import { BeforeRegisterPage } from './before-register.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BeforeRegisterPageRoutingModule
  ],
  declarations: [BeforeRegisterPage]
})
export class BeforeRegisterPageModule {}
