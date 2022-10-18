import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ModalController, NavParams } from '@ionic/angular';
import * as QRCode from "qrcode-svg";
import { P5ToastService } from 'src/app/p5-toast.service';
import { NakamaService } from 'src/app/nakama.service';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
})
export class GroupDetailPage implements OnInit {

  constructor(
    private navParams: NavParams,
    private sanitizer: DomSanitizer,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
  ) { }

  QRCodeSRC: any;
  info: any;
  is_removable = false;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.readasQRCodeFromId();
    this.is_removable =
      this.nakama.servers[this.info.server['isOfficial']][this.info.server['target']].session.user_id == this.info['owner'];
  }

  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickLickInputFile() {
    document.getElementById('file_sel').click();
  } inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.nakama.limit_image_size(ev, (v) => {
        this.info.img = v['canvas'].toDataURL();
        if (!this.info['img_id']) {
          console.warn('이미지id가 없으면 이미지id를 만들면서 이미지 등록하기 기능 없음');
          return;
        }
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.writeStorageObjects(
          this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, [{
            collection: 'group_public',
            key: this.info.img_id,
            value: { img: this.info.img },
            permission_read: 2,
            permission_write: 1,
          }]
        );
      });
    };
    reader.readAsDataURL(ev.target.files[0]);
  }

  readasQRCodeFromId() {
    try {
      let except_img = { ...this.info };
      delete except_img.img;
      let qr: string = new QRCode({
        content: `[${JSON.stringify(except_img)}]`,
        padding: 4,
        width: 16,
        height: 16,
        color: "#bbb",
        background: "#111",
        ecl: "M",
      }).svg();
      this.QRCodeSRC = this.sanitizer.bypassSecurityTrustUrl(`data:image/svg+xml;base64,${btoa(qr)}`);
    } catch (e) {
      this.p5toast.show({
        text: `QRCode 생성 실패: ${e}`,
      });
    }
  }

  remove_group() {
    this.nakama.remove_group_list(this.info, this.info.server['isOfficial'], this.info.server['target'], () => {
      this.modalCtrl.dismiss();
    });
  }
}
