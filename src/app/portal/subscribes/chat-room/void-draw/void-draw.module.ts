import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VoidDrawPageRoutingModule } from './void-draw-routing.module';

import { VoidDrawPage } from './void-draw.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VoidDrawPageRoutingModule
  ],
  declarations: [VoidDrawPage]
})
export class VoidDrawPageModule {}
