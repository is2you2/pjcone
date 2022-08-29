import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TaskInfoPageRoutingModule } from './task-info-routing.module';

import { TaskInfoPage } from './task-info.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TaskInfoPageRoutingModule
  ],
  declarations: [TaskInfoPage]
})
export class TaskInfoPageModule {}
