import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { P5ToastService } from 'src/app/p5-toast.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
})
export class MainPage implements OnInit {

  constructor(
    private app: GlobalActService,
    private p5toast: P5ToastService,
    private alertCtrl: AlertController,
  ) { }

  ngOnInit() { }

  ionViewWillEnter() {
    this.app.CreateGodotIFrame('godot-todo', {
      act: 'godot-todo',
      permit: () => {
        this.alertCtrl.create({
          header: '없는 패키지',
          message: '해야할 일 기능을 다운받습니다.',
          buttons: [{
            text: '다운받기',
            handler: () => {
              console.log('다운받기 버튼 눌림');
            },
          }]
        }).then(v => v.present());
      },
      failed: () => {
        this.p5toast.show({
          text: '패키지 다운로드 실패',
        });
      }
    });
  }
}
