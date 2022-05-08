import { Component } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { LoginPage } from './account/login/login.page';
import { NakamaclientService } from './nakamaclient.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(public nakama: NakamaclientService,
    public alert: AlertController,
    public modal: ModalController,
  ) {
    this.initialized_client();
  }

  async initialized_client() {
    if (await this.nakama.initialize()) {
      setTimeout(() => {
        this.modal.create({
          component: LoginPage,
        }).then(v => {
          v.present();
        });
      }, 700);
    } else {
      this.alert.create({
        header: '서버 휴가중',
        message: '활동할 수는 없지만 마지막 기록들을 토대로 페이지를 돌아다닐 수 있습니다.',
        buttons: [{
          text: '오케이~',
        }]
      }).then(v => {
        v.present();
      });
    }
  }
}
