import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { StarcraftCustomPageRoutingModule } from './starcraft-custom-routing.module';

import { StarcraftCustomPage } from './starcraft-custom.page';
import { CampaignPanelComponent } from './campaign-panel/campaign-panel.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StarcraftCustomPageRoutingModule
  ],
  declarations: [StarcraftCustomPage,
  CampaignPanelComponent]
})
export class StarcraftCustomPageModule {}
