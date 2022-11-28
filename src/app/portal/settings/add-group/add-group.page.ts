import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';
import { isPlatform } from 'src/app/app.component';
import clipboard from "clipboardy";

@Component({
  selector: 'app-add-group',
  templateUrl: './add-group.page.html',
  styleUrls: ['./add-group.page.scss'],
})
export class AddGroupPage implements OnInit {

  constructor(
    private navCtrl: NavController,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
    private sanitizer: DomSanitizer,
  ) { }

  QRCodeSRC: any;

  ngOnInit() {
    let tmp = JSON.parse(localStorage.getItem('add-group'));
    if (tmp)
      this.userInput = tmp;
    this.servers = this.nakama.get_all_server_info(true, true);
    this.userInput.server = this.servers[this.index];
  }

  /** 그룹ID를 QRCode로 그려내기 */
  readasQRCodeFromId() {
    try {
      let info = {
        type: 'group',
        id: this.userInput.id,
        title: this.userInput.name,
      };
      let qr: string = new QRCode({
        content: `[${JSON.stringify(info)}]`,
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

  userInput = {
    server: undefined,
    id: undefined,
    name: undefined,
    description: undefined,
    max_count: undefined,
    lang_tag: undefined,
    open: false,
    creator_id: undefined,
    img: undefined,
  }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  servers: ServerInfo[] = [];
  index = 0;
  isExpanded = true;

  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
  }

  /** 클립보드 사용가능 여부 */
  cant_use_clipboard = false;
  imageURL_disabled = false;
  imageURL_placeholder = '눌러서 외부이미지 주소 붙여넣기';
  /** 외부 주소 붙여넣기 */
  imageURLPasted() {
    if (isPlatform != 'DesktopPWA') return;
    this.imageURL_disabled = true;
    clipboard.read().then(v => {
      if (v.indexOf('http') == 0) {
        this.userInput.img = v;
        this.imageURL_placeholder = v;
      } else if (v.indexOf('data:image') == 0) {
        this.nakama.limit_image_size({
          target: { result: [v] },
        }, (rv) => this.userInput.img = rv['canvas'].toDataURL());
      } else {
        this.p5toast.show({
          text: '먼저 웹 페이지에서 이미지 주소를 복사해주세요',
        });
      }
    });
    setTimeout(() => {
      this.imageURL_disabled = false;
    }, 1500);
  }

  /** 공개여부 토글 */
  isPublicToggle() {
    this.userInput.open = !this.userInput.open;
  }

  isSaveClicked = false;
  /** 정상처리되지 않았다면 작성 중 정보 임시 저장 */
  isSavedWell = false;
  save() {
    let client = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].client;
    if (!client) { // 클라이언트 존재 여부 검토
      this.p5toast.show({
        text: '선택한 서버를 사용할 수 없습니다.',
      });
      return;
    }

    let session = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session;
    if (!session) { // 세션 검토
      console.warn('refreshToken 등 검토 필요');
      this.p5toast.show({
        text: '세션이 종료되었습니다.',
      });
      return;
    }

    this.isSaveClicked = true;
    this.userInput.lang_tag = this.userInput.lang_tag || 'ko';
    this.userInput.max_count = this.userInput.max_count || 2;
    client.createGroup(session, {
      name: this.userInput.name,
      lang_tag: this.userInput.lang_tag,
      description: this.userInput.description,
      max_count: this.userInput.max_count,
      open: this.userInput.open,
    }).then(v => {
      this.userInput.id = v.id;
      this.userInput.creator_id = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session.user_id;
      this.readasQRCodeFromId();
      this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].client.writeStorageObjects(
        this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session, [{
          collection: 'group_public',
          key: `group_${this.userInput.id}`,
          permission_read: 2,
          permission_write: 1,
          value: { img: this.userInput.img },
        }]
      );
      this.nakama.save_group_info(this.userInput, this.servers[this.index].isOfficial, this.servers[this.index].target, () => {
        this.isSavedWell = true;
        localStorage.removeItem('add-group');
        this.p5toast.show({
          text: '그룹이 생성되었습니다.',
        });
        setTimeout(() => {
          this.navCtrl.back();
        }, 500);
      });
    }).catch(e => {
      console.error('그룹 생성 실패: ', e);
      switch (e.status) {
        case 400:
          setTimeout(() => {
            this.p5toast.show({
              text: '그룹 이름을 작성해주세요.',
            });
            this.isSaveClicked = false;
          }, 500);
          break;
        case 409:
          setTimeout(() => {
            this.p5toast.show({
              text: '이미 같은 이름의 그룹이 존재합니다.',
            });
            this.isSaveClicked = false;
          }, 500);
          break;
        default:
          setTimeout(() => {
            this.p5toast.show({
              text: `준비되지 않은 오류처리: ${e}`,
            });
            this.isSaveClicked = false;
          }, 500);
          break;
      }
    });
  }

  ionViewWillLeave() {
    if (!this.isSavedWell) {
      localStorage.setItem('add-group', JSON.stringify(this.userInput));
    }
  }

  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickLinkInputFile() {
    document.getElementById('file_sel').click();
  }

  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      this.nakama.limit_image_size(ev, (v) => this.userInput.img = v['canvas'].toDataURL())
    };
    reader.readAsDataURL(ev.target.files[0]);
  }
}
