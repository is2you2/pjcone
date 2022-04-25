import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { NakamaclientService } from '../nakamaclient.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(public nakama: NakamaclientService,
    public alert: AlertController,
  ) { }

  ngOnInit() { }

}
