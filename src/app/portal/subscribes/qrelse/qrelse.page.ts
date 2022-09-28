import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
import * as p5 from "p5";

@Component({
  selector: 'app-qrelse',
  templateUrl: './qrelse.page.html',
  styleUrls: ['./qrelse.page.scss'],
})
export class QRelsePage implements OnInit {

  constructor(
    private navParams: NavParams,
    public modalCtrl: ModalController,
  ) {
  }

  /** 바코드 결과물에 대해 */
  info = 'QR코드 또는 바코드를 인식하였으나 이 앱에서 사용하는 구성이 아닙니다.';
  /** 바코드 스캔 결과물 */
  result: any = {};

  ngOnInit() {
    this.result = this.navParams.get('result');
  }
}
