import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LinkAccountPageRoutingModule } from './link-account-routing.module';

import { LinkAccountPage } from './link-account.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LinkAccountPageRoutingModule
  ],
  declarations: [LinkAccountPage]
})
export class LinkAccountPageModule {}
