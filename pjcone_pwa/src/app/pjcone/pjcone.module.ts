import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PjconePageRoutingModule } from './pjcone-routing.module';

import { PjconePage } from './pjcone.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PjconePageRoutingModule
  ],
  declarations: [PjconePage]
})
export class PjconePageModule {}
