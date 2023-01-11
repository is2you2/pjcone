import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GodotViewerPageRoutingModule } from './godot-viewer-routing.module';

import { GodotViewerPage } from './godot-viewer.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GodotViewerPageRoutingModule
  ],
  declarations: [GodotViewerPage]
})
export class GodotViewerPageModule {}
