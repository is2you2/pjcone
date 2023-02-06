// SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
// SPDX-License-Identifier: MIT

import { Component, OnInit } from '@angular/core';
import { LocalNotiService } from 'src/app/local-noti.service';

@Component({
  selector: 'app-receive-act',
  templateUrl: './receive-act.page.html',
  styleUrls: ['./receive-act.page.scss'],
})
export class ReceiveActPage implements OnInit {

  constructor(
    public localPush: LocalNotiService,
  ) { }

  ngOnInit() { }

}
