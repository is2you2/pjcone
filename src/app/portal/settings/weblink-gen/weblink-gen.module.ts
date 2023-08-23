import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WeblinkGenPageRoutingModule } from './weblink-gen-routing.module';

import { WeblinkGenPage } from './weblink-gen.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WeblinkGenPageRoutingModule
  ],
  declarations: [WeblinkGenPage]
})
export class WeblinkGenPageModule {}
