import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserFsDirPageRoutingModule } from './user-fs-dir-routing.module';

import { UserFsDirPage } from './user-fs-dir.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserFsDirPageRoutingModule
  ],
  declarations: [UserFsDirPage]
})
export class UserFsDirPageModule {}
