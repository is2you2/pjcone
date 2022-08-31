import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-projinfo',
  templateUrl: './projinfo.page.html',
  styleUrls: ['./projinfo.page.scss'],
})
export class ProjinfoPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
  ) { }

  ngOnInit() { }

}
