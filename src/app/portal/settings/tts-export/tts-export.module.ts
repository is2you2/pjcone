import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TtsExportPageRoutingModule } from './tts-export-routing.module';

import { TtsExportPage } from './tts-export.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TtsExportPageRoutingModule
  ],
  declarations: [TtsExportPage]
})
export class TtsExportPageModule {}
