import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MinimalChatPageRoutingModule } from './minimal-chat-routing.module';

import { MinimalChatPage } from './minimal-chat.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MinimalChatPageRoutingModule
  ],
  declarations: [MinimalChatPage]
})
export class MinimalChatPageModule {}
