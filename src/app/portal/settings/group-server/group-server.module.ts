import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GroupServerPageRoutingModule } from './group-server-routing.module';

import { GroupServerPage } from './group-server.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GroupServerPageRoutingModule
  ],
  declarations: [GroupServerPage]
})
export class GroupServerPageModule {}
