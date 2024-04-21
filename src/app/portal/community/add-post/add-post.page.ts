import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { FileInfo, GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { GroupServerPage } from '../../settings/group-server/group-server.page';
import { P5ToastService } from 'src/app/p5-toast.service';

/** 첨부파일 리스트 양식  
 * [{ 주소(또는 경로), 자료 형식(url | data) }, ...]
 */
interface PostAttachment extends FileInfo {
  /** 데이터 구성요소
   * - url: 외부 링크 정보, url 텍스트가 작성됨
   * - part: nakama_parted 정보, 데이터 경로(collection-key)가 작성됨 (path)
   * - blob: 파일이 첨부됨, 게시물 작성 중일 때 사용되며 게시하는 과정에서 url 또는 part 로 변환됨
   */
  datatype: 'url' | 'part' | 'blob';
}

@Component({
  selector: 'app-add-post',
  templateUrl: './add-post.page.html',
  styleUrls: ['./add-post.page.scss'],
})
export class AddPostPage implements OnInit {
  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    private navCtrl: NavController,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
  ) { }

  servers: ServerInfo[] = [];
  userInput = {
    title: undefined,
    /** 대표 이미지 설정, blob 링크 */
    titleImage: undefined,
    /** 내용물, txt 파일 변환하여 저장됨 */
    content: undefined,
    creator_id: undefined,
    creator_name: undefined,
    UserColor: undefined,
    create_time: undefined,
    modify_time: undefined,
    server: undefined,
    attachments: [] as PostAttachment[],
  }
  index = 0;
  isOfficial: string;
  target: string;

  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true, true);
    let local_info = {
      name: this.lang.text['AddGroup']['UseLocalStorage'],
      isOfficial: 'local',
      target: 'channels',
      local: true,
    };
    this.servers.unshift(local_info);
    if (this.servers.length > 1) this.index = 1;
    this.select_server(this.index);
    this.userInput.creator_name = this.nakama.users.self['display_name'];
  }

  BottomTabShortcut: any;
  /** 하단 탭 단축키 캐싱 */
  catchBottomTabShortCut() {
    this.BottomTabShortcut = this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
  }

  ionViewWillEnter() {
    this.AddShortcut();
    this.catchBottomTabShortCut();
    let title_input = document.getElementById('add_post_title').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
    if (!this.userInput.title)
      title_input.focus();
    else document.getElementById('add_post_content').focus();
  }

  go_to_profile() {
    this.modalCtrl.create({
      component: GroupServerPage,
      componentProps: {
        isOfficial: this.isOfficial,
        target: this.target,
      }
    }).then(v => v.present());
  }

  /** 서버 선택지 열림 여부 */
  isExpanded = false;
  /** 저장버튼 눌림 여부 */
  isSaveClicked = false;
  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
    this.isOfficial = this.servers[i].isOfficial;
    this.target = this.servers[i].target;
    try { // 변경된 서버 user_id 를 적용함
      this.userInput.creator_id = this.nakama.servers[this.isOfficial][this.target].session.user_id;
      this.userInput.UserColor = (this.userInput.creator_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
    } catch (e) { // 그게 아니라면 로컬입니다
      this.userInput.creator_id = this.nakama.users.self['display_name'];
      this.userInput.creator_name = this.nakama.users.self['display_name'];
      this.userInput.UserColor = '888888';
    }
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        this.navCtrl.navigateBack('portal/community');
      };
    }
  }

  /** 첨부파일 동작 */
  add_attachment(type: string) {
    console.log('add_attachment: ', type);
    if (this.isSaveClicked) return;
    switch (type) {
      case 'load':
        break;
      case 'voidDraw':
        break;
      case 'camera':
        break;
      case 'voice':
        break;
    }
    this.userInput.attachments.push({
      filename: 'test.psd',
      datatype: 'url',
    });
  }

  /** 포스트 등록하기  
   * 글 내용이 길어질 수 있으므로 글이 아무리 짧더라도 txt 파일로 변환하여 게시
   */
  postData() {
    if (!this.userInput.title) {
      this.p5toast.show({
        text: this.lang.text['AddPost']['NeedPostTitle'],
      });
      let title_input = document.getElementById('add_post_title').childNodes[1].childNodes[1].childNodes[1] as HTMLInputElement;
      title_input.focus();
      return;
    }
    this.p5toast.show({
      text: '게시물 작성 기능 준비중',
    });
    this.isSaveClicked = true;
    // 너무 긴 제목 자르기
    // 게시글의 도입부 첫 줄 자르기
    // 게시물 날짜 업데이트
    if (this.userInput.create_time) { // 생성 시간이 있다면 편집으로 간주
      this.userInput.modify_time = new Date().getTime();
    } else { // 생성 시간이 없다면 최초 생성으로 간주
      this.userInput.create_time = new Date().getTime();
    }
    // 서버 정보 지우기
    // 전체 정보(UserInput)를 텍스트 파일화
    // 서버에 동기화
    console.log('입력됨: ', this.userInput);
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.global.p5key['KeyShortCut']['BottomTab'] = this.BottomTabShortcut;
  }
}
