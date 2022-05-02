import { Component } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { NakamaclientService } from './nakamaclient.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {
  constructor(public nakama: NakamaclientService,
    public alert: AlertController,
    public navCtrl: NavController,
  ) {
    this.initialized_client();
  }


  async initialized_client() {
    if (await this.nakama.initialize()) {
      this.navCtrl.navigateRoot('login', {
        animated: true,
        animationDirection: 'forward',
      });
    } else {
      this.alert.create({
        header: '서버 휴가중',
        message: '활동할 수는 없지만 마지막 기록들을 토대로 페이지를 돌아다닐 수 있습니다.',
        backdropDismiss: false,
        buttons: [{
          handler: v => {
            this.navCtrl.navigateRoot('portal', {
              animated: true,
              animationDirection: 'forward',
            });
          },
          text: '오케이~',
        }]
      }).then(v => {
        v.present();
      });
    }
  }
}
