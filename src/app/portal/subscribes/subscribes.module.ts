import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SubscribesPageRoutingModule } from './subscribes-routing.module';

import { SubscribesPage } from './subscribes.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SubscribesPageRoutingModule
  ],
  declarations: [SubscribesPage]
})
export class SubscribesPageModule {}
