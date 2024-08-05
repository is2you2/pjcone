import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ArcadePageRoutingModule } from './arcade-routing.module';

import { ArcadePage } from './arcade.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ArcadePageRoutingModule
  ],
  declarations: [ArcadePage]
})
export class ArcadePageModule {}
