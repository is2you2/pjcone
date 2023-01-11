import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { IonicViewerPageRoutingModule } from './ionic-viewer-routing.module';

import { IonicViewerPage } from './ionic-viewer.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    IonicViewerPageRoutingModule
  ],
  declarations: [IonicViewerPage]
})
export class IonicViewerPageModule {}
