import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CommunityServerPageRoutingModule } from './community-server-routing.module';

import { CommunityServerPage } from './community-server.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CommunityServerPageRoutingModule
  ],
  declarations: [CommunityServerPage]
})
export class CommunityServerPageModule {}
