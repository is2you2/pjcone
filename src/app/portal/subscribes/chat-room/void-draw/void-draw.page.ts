import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import * as p5 from "p5";
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-void-draw',
  templateUrl: './void-draw.page.html',
  styleUrls: ['./void-draw.page.scss'],
})
export class VoidDrawPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
    public modalCtrl: ModalController,
  ) { }

  ngOnInit() { }

  ionViewDidEnter() {
    this.init_void_draw();
  }

  p5canvas: p5;
  init_void_draw() {
    let targetDiv = document.getElementById('p5_void_draw');
    this.p5canvas = new p5((p: p5) => {
      p.setup = () => {
        console.log(targetDiv);
        console.log(targetDiv.clientWidth, targetDiv.clientHeight);
        console.log(targetDiv.offsetWidth, targetDiv.offsetHeight);
        let canvas = p.createCanvas(targetDiv.clientWidth, targetDiv.clientHeight);
        canvas.parent(targetDiv);
      }
      p.draw = () => {

      }
    });
  }

  ionViewDidLeave() {
    this.p5canvas.remove();
  }
}
