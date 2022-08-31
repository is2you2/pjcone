import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DedicatedSettingsPageRoutingModule } from './dedicated-settings-routing.module';

import { DedicatedSettingsPage } from './dedicated-settings.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DedicatedSettingsPageRoutingModule
  ],
  declarations: [DedicatedSettingsPage]
})
export class DedicatedSettingsPageModule {}
