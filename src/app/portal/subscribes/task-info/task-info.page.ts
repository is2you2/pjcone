import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-task-info',
  templateUrl: './task-info.page.html',
  styleUrls: ['./task-info.page.scss'],
})
export class TaskInfoPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
  ) { }

  ngOnInit() { }

}
