import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AdminToolsPageRoutingModule } from './admin-tools-routing.module';

import { AdminToolsPage } from './admin-tools.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AdminToolsPageRoutingModule
  ],
  declarations: [AdminToolsPage]
})
export class AdminToolsPageModule {}
