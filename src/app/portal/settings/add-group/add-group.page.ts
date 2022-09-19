import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import * as QRCode from "qrcode-svg";
import { DomSanitizer } from '@angular/platform-browser';
import { ServerInfo } from '../group-server/group-server.page';

/** 읽었을 때 기기가 순차적으로 처리할 수 있는 양식  
 * string[]: 해당 내용의 id값만 나열되어있음  
 * 위부터 순차적으로 (서버 > 그룹 > ...) 처리하면 오류 없을 예정
 */
export interface QRCodeForm {
  /** 이 서버에서만 처리한다, 대상 서버 */
  server?: ServerInfo;
  /** 그룹 아이디 전부 가입처리 */
  groups?: string[];
  /** 사용자 아이디 전부 친구추가 */
  users?: string[];
  /** 대화방 전부 가입처리 */
  chats?: string[];
  /** 프로젝트 전부 참여 */
  projects?: string[];
  /** 업무 전부 참여 */
  tasks?: string[];
}

interface GroupInfo {
  server: ServerInfo;
  id: string;
  title: string;
  desc: string;
  max: number;
  lang: string;
  isPublic: boolean;
  owner?: string;
}

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
    this.userInput.server = this.servers[this.index];
  }

  /** 그룹ID를 QRCode로 그려내기 */
  readasQRCodeFromId() {
    try {
      let info: QRCodeForm = {
        server: this.userInput.server,
        groups: [this.userInput.id], // 그룹 아이디를 통해 서버에서 나머지 정보 받아오기
      }
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

  userInput: GroupInfo = {
    server: undefined,
    id: undefined,
    title: undefined,
    desc: undefined,
    max: undefined,
    lang: undefined,
    isPublic: false,
  }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  servers: ServerInfo[] = [{
    name: '개발 테스트 서버_test',
    target: 'default',
    isOfficial: 'official',
    address: 'pjcone.ddns.net',
  }, {
    name: 'test2 (x) 동작 안함',
    target: 'default',
    isOfficial: 'unofficial',
    address: 'test.exe.com'
  }];
  index = 0;
  isExpanded = true;

  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
  }

  /** 공개여부 토글 */
  isPublicToggle() {
    this.userInput.isPublic = !this.userInput.isPublic;
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
    client.createGroup(session, {
      name: this.userInput.title,
      lang_tag: this.userInput.lang ?? 'ko',
      description: this.userInput.desc,
      max_count: this.userInput.max ?? 2,
      open: this.userInput.isPublic,
    }).then(v => {
      this.userInput.id = v.id;
      this.userInput.owner = this.nakama.servers[this.servers[this.index].isOfficial][this.servers[this.index].target].session.user_id;
      this.readasQRCodeFromId();
      this.nakama.save_group_list(this.userInput, this.servers[this.index].isOfficial, this.servers[this.index].target, () => {
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
    if (!this.isSavedWell)
      localStorage.setItem('add-group', JSON.stringify(this.userInput));
  }

  /** ionic 버튼을 눌러 input-file 동작 */
  buttonClickLickInputFile() {
    document.getElementById('file_sel').click();
  }

  /** 파일 선택시 로컬에서 반영 */
  inputImageSelected(ev: any) {
    let reader: any = new FileReader();
    reader = reader._realReader ?? reader;
    reader.onload = (ev: any) => {
      let img: any = document.getElementById('group_img');
      img.src = ev.target.result;
    }
    reader.readAsDataURL(ev.target.files[0]);
  }

  /** 선택된 그룹 이미지 업로드 필요 */
  upload_image() {
    console.error('이미지 업로드가 필요한데요');
  }
}
