import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EnginepptPageRoutingModule } from './engineppt-routing.module';

import { EnginepptPage } from './engineppt.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EnginepptPageRoutingModule
  ],
  declarations: [EnginepptPage]
})
export class EnginepptPageModule {}
