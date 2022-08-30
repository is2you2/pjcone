import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProjinfoPageRoutingModule } from './projinfo-routing.module';

import { ProjinfoPage } from './projinfo.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProjinfoPageRoutingModule
  ],
  declarations: [ProjinfoPage]
})
export class ProjinfoPageModule {}
