import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StarcraftCustomPageRoutingModule } from './starcraft-custom-routing.module';

import { StarcraftCustomPage } from './starcraft-custom.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StarcraftCustomPageRoutingModule
  ],
  declarations: [StarcraftCustomPage]
})
export class StarcraftCustomPageModule {}
