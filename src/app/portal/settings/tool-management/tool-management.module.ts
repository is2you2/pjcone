import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ToolManagementPageRoutingModule } from './tool-management-routing.module';

import { ToolManagementPage } from './tool-management.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ToolManagementPageRoutingModule
  ],
  declarations: [ToolManagementPage]
})
export class ToolManagementPageModule {}
