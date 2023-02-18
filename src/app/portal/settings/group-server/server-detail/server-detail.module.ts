import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ServerDetailPageRoutingModule } from './server-detail-routing.module';

import { ServerDetailPage } from './server-detail.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ServerDetailPageRoutingModule
  ],
  declarations: [ServerDetailPage]
})
export class ServerDetailPageModule {}
