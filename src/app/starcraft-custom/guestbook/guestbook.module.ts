import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GuestbookPageRoutingModule } from './guestbook-routing.module';

import { GuestbookPage } from './guestbook.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    GuestbookPageRoutingModule
  ],
  declarations: [GuestbookPage]
})
export class GuestbookPageModule {}
