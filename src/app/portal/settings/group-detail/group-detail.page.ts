import { Component, OnInit } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ModalController, NavParams } from '@ionic/angular';
import * as QRCode from "qrcode-svg";
import { P5ToastService } from 'src/app/p5-toast.service';
import { NakamaService } from 'src/app/nakama.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { IndexedDBService } from 'src/app/indexed-db.service';

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
    public nakama: NakamaService,
    private modalCtrl: ModalController,
    public statusBar: StatusManageService,
    private indexed: IndexedDBService,
  ) { }

  QRCodeSRC: any;
  info: any;
  has_admin = false;

  ngOnInit() {
    this.info = this.navParams.get('info');
    this.readasQRCodeFromId();
    this.has_admin = this.statusBar.groupServer[this.info.server['isOfficial']][this.info.server['target']] == 'online' &&
      this.nakama.servers[this.info.server['isOfficial']][this.info.server['target']].session.user_id == this.info['owner'];
  }

  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickInputFile() {
    if (this.has_admin)
      document.getElementById('file_sel').click();
  } inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.nakama.limit_image_size(ev, (v) => {
        this.info.img = v['canvas'].toDataURL();
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.writeStorageObjects(
          this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session, [{
            collection: 'group_public',
            key: `group_${this.info.id}`,
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
      let except_some = { ...this.info };
      delete except_some.img;
      delete except_some.server;
      except_some['type'] = 'group';
      let qr: string = new QRCode({
        content: `[${JSON.stringify(except_some)}]`,
        padding: 4,
        width: 8,
        height: 8,
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

  edit_group() {
    if (this.has_admin)
      this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].client.updateGroup(
        this.nakama.servers[this.info['server']['isOfficial']][this.info['server']['target']].session,
        this.info['id'],
        {
          name: this.info['title'],
          lang_tag: this.info['lang'],
          description: this.info['desc'],
          open: this.info['isPublic'],
        }
      ).then(_v => {
        this.modalCtrl.dismiss();
      });
    else this.modalCtrl.dismiss();
    let less_info = { ...this.info };
    delete less_info['server'];
    delete less_info['img'];
    this.nakama.groups[this.info['server']['isOfficial']][this.info['server']['target']][this.info['id']] = less_info;
    this.indexed.saveTextFileToUserPath(JSON.stringify(this.nakama.groups), 'servers/groups.json');
  }
}
