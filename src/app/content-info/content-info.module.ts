import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ContentInfoPageRoutingModule } from './content-info-routing.module';

import { ContentInfoPage } from './content-info.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContentInfoPageRoutingModule
  ],
  declarations: [ContentInfoPage]
})
export class ContentInfoPageModule {}
