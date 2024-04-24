import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import * as p5 from 'p5';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { IonicViewerPage } from '../../subscribes/chat-room/ionic-viewer/ionic-viewer.page';
import { GroupServerPage } from '../../settings/group-server/group-server.page';
import { NakamaService } from 'src/app/nakama.service';
import { GlobalActService } from 'src/app/global-act.service';

@Component({
  selector: 'app-post-viewer',
  templateUrl: './post-viewer.page.html',
  styleUrls: ['./post-viewer.page.scss'],
})
export class PostViewerPage implements OnInit {

  constructor(
    public modalCtrl: ModalController,
    private navParam: NavParams,
    public lang: LanguageSettingService,
    private indexed: IndexedDBService,
    private nakama: NakamaService,
    private alertCtrl: AlertController,
    private global: GlobalActService,
  ) { }

  PostInfo: any;
  isOwner = false;
  FileURLs = [];
  ngOnInit() {
    this.PostInfo = this.navParam.get('data');
    if (this.PostInfo['mainImage']) {
      let FileURL = URL.createObjectURL(this.PostInfo['mainImage']['blob']);
      this.PostInfo['mainImage']['MainThumbnail'] = FileURL;
      this.FileURLs.push(FileURL);
    }
    this.create_content();
    this.isOwner = this.PostInfo['creator_id'] == 'local'
      || this.PostInfo['creator_id'] == this.nakama.servers[this.PostInfo['server']['isOfficial']][this.PostInfo['server']['target']].session.user_id;
  }

  p5canvas: p5;
  /** 내용에 파일 뷰어를 포함한 구성 만들기 */
  create_content() {
    let contentDiv = document.getElementById('PostContent');
    this.p5canvas = new p5((p: p5) => {
      p.setup = async () => {
        p.noCanvas();
        // 제목
        let title = p.createDiv(this.PostInfo['title']);
        title.style('font-size', '32px');
        title.style('font-weight', 'bold');
        title.parent(contentDiv);
        // 작성일
        let datetime = p.createDiv();
        datetime.style('color', '#888');
        datetime.parent(contentDiv);
        let create_time = p.createDiv(`${this.lang.text['PostViewer']['CreateTime']}: ${new Date(this.PostInfo['create_time']).toLocaleString()}`);
        create_time.parent(datetime);
        if (this.PostInfo['create_time'] != this.PostInfo['modify_time']) {
          let modify_time = p.createDiv(`${this.lang.text['PostViewer']['ModifyTime']}: ${new Date(this.PostInfo['modify_time']).toLocaleString()}`);
          modify_time.parent(datetime);
        }
        // 작성자
        let creatorForm = p.createDiv();
        creatorForm.style('padding-bottom', '8px');
        creatorForm.parent(contentDiv);
        let creator = p.createSpan(this.PostInfo['creator_name']);
        creator.style('color', `#${this.PostInfo['UserColor']}`);
        creator.style('font-weight', 'bold');
        creator.style('cursor', 'pointer');
        creator.elt.onclick = () => {
          if (this.isOwner) {
            this.modalCtrl.create({
              component: GroupServerPage,
            }).then(v => v.present());
          } else { // 서버 사용자 검토

          }
        }
        creator.parent(creatorForm);
        // 첨부파일 불러오기
        for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++) {
          let blob = await this.indexed.loadBlobFromUserPath(this.PostInfo['attachments'][i]['path'], this.PostInfo['attachments'][i]['type']);
          this.PostInfo['attachments'][i]['blob'] = blob;
        }
        // 내용
        if (this.PostInfo['content']) {
          let content: string[] = this.PostInfo['content'].split('\n');
          for (let i = 0, j = content.length; i < j; i++) {
            // 첨부파일인지 체크
            let is_attach = false;
            let content_len = content[i].length - 1;
            let index = 0;
            try {
              index = Number(content[i].substring(1, content_len));
              is_attach = content[i].charAt(0) == '[' && content[i].charAt(content_len) == ']' && !isNaN(index);
            } catch (e) { }
            if (is_attach) {
              switch (this.PostInfo['attachments'][index]['viewer']) {
                case 'image': {
                  let FileURL = this.PostInfo['attachments'][index]['url'];
                  if (!FileURL) try {
                    FileURL = URL.createObjectURL(this.PostInfo['attachments'][index]['blob']);
                    this.FileURLs.push(FileURL);
                  } catch (e) {
                    console.log('게시물 image 첨부파일 불러오기 오류: ', e);
                  }
                  let img = p.createImg(FileURL, `${index}`);
                  img.style('cursor', 'pointer');
                  img.elt.onclick = () => {
                    let createRelevances = [];
                    for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++)
                      createRelevances.push({ content: this.PostInfo['attachments'][i] });
                    this.modalCtrl.create({
                      component: IonicViewerPage,
                      componentProps: {
                        info: { content: this.PostInfo['attachments'][index] },
                        path: this.PostInfo['attachments'][index]['path'],
                        relevance: createRelevances,
                        noEdit: true,
                      },
                      cssClass: 'fullscreen',
                    }).then(v => v.present());
                  }
                  img.parent(contentDiv);
                }
                  break;
                case 'audio': {
                  let FileURL = this.PostInfo['attachments'][index]['url'];
                  if (!FileURL) try {
                    FileURL = URL.createObjectURL(this.PostInfo['attachments'][i]['blob']);
                    this.FileURLs.push(FileURL);
                  } catch (e) {
                    console.log('게시물 audio 첨부파일 불러오기 오류: ', e);
                  }
                  let audio = p.createAudio([FileURL]);
                  audio.showControls();
                  audio.parent(contentDiv);
                }
                  break;
                case 'video': {
                  let FileURL = this.PostInfo['attachments'][index]['url'];
                  if (!FileURL) try {
                    FileURL = URL.createObjectURL(this.PostInfo['attachments'][i]['blob']);
                    this.FileURLs.push(FileURL);
                  } catch (e) {
                    console.log('게시물 video 첨부파일 불러오기 오류: ', e);
                  }
                  let video = p.createVideo([FileURL]);
                  video.style('width', '100%');
                  video.style('height', 'auto');
                  video.showControls();
                  video.parent(contentDiv);
                }
                  break;
                case 'godot': {
                  let targetFrameId = `PostViewer_godot_pck_${index}`;
                  let godot_frame = p.createDiv();
                  godot_frame.id(targetFrameId);
                  godot_frame.style('width', '100%');
                  godot_frame.style('height', '432px');
                  godot_frame.parent(contentDiv);
                  setTimeout(async () => {
                    let createDuplicate = false;
                    if (this.indexed.godotDB) {
                      try {
                        await this.indexed.GetGodotIndexedDB();
                        await this.indexed.saveBlobToUserPath(this.PostInfo['attachments'][i]['blob'], `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`, undefined, this.indexed.godotDB);
                        createDuplicate = true;
                      } catch (e) {
                        console.log('내부 파일 없음: ', e);
                      }
                    }
                    await this.global.CreateGodotIFrame(targetFrameId, {
                      path: `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`,
                      url: this.PostInfo['attachments'][index].url,
                    }, 'start_load_pck', true);
                    if (!createDuplicate) {
                      try { // 내부에 파일이 있는지 검토
                        let blob = await this.indexed.loadBlobFromUserPath(
                          this.PostInfo['attachments'][index]['path'], '', undefined, this.indexed.ionicDB);
                        await this.indexed.GetGodotIndexedDB();
                        await this.indexed.saveBlobToUserPath(blob, `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`, undefined, this.indexed.godotDB);
                      } catch (e) { }
                      await this.global.CreateGodotIFrame(targetFrameId, {
                        path: `tmp_files/duplicate/${this.PostInfo['attachments'][index]['filename']}`,
                        url: this.PostInfo['attachments'][index].url,
                      }, 'start_load_pck', true);
                    }
                    if (this.PostInfo['attachments'][index].url)
                      this.global.godot_window['download_url']();
                    else this.global.godot_window['start_load_pck']();
                  }, 100);
                }
                  break;
                case 'blender':
                case 'code':
                case 'text':
                case 'disabled': // 사용 불가
                default: { // 읽을 수 없는 파일들은 클릭시 뷰어 연결 div 생성 (채널 채팅 썸네일과 비슷함)
                  let EmptyDiv = p.createDiv();
                  EmptyDiv.style('width', '160px');
                  EmptyDiv.style('height', '112px');
                  EmptyDiv.style('overflow', 'hidden');
                  EmptyDiv.style('background-color', 'grey');
                  EmptyDiv.style('margin-top', '4px');
                  EmptyDiv.style('border-radius', '8px');
                  EmptyDiv.style('cursor', 'pointer');
                  EmptyDiv.parent(contentDiv);
                  let FileName = p.createP(this.PostInfo['attachments'][index]['filename']);
                  FileName.style('margin', '0px 4px');
                  FileName.style('text-align', 'start');
                  FileName.parent(EmptyDiv);
                  let Seperator = p.createDiv();
                  Seperator.style('background-color', 'white');
                  Seperator.style('margin-top', '2px');
                  Seperator.style('position', 'relative');
                  Seperator.style('width', '100%');
                  Seperator.style('height', '2px');
                  Seperator.parent(EmptyDiv);
                  let OpenViewerInfo = p.createSpan(this.lang.text['PostViewer']['OpenFromViewer']);
                  OpenViewerInfo.style('margin', '2px 4px 0px 4px');
                  OpenViewerInfo.style('text-align', 'start');
                  OpenViewerInfo.style('display', 'grid');
                  OpenViewerInfo.parent(EmptyDiv);
                  EmptyDiv.elt.onclick = () => {
                    let createRelevances = [];
                    for (let i = 0, j = this.PostInfo['attachments'].length; i < j; i++)
                      createRelevances.push({ content: this.PostInfo['attachments'][i] });
                    this.modalCtrl.create({
                      component: IonicViewerPage,
                      componentProps: {
                        info: { content: this.PostInfo['attachments'][index] },
                        path: this.PostInfo['attachments'][index]['path'],
                        relevance: createRelevances,
                        noEdit: true,
                      },
                      cssClass: 'fullscreen',
                    }).then(v => v.present());
                  }
                }
                  break;
              }
            } else { // 일반 문자열
              let line = p.createDiv(content[i] + '&nbsp');
              line.parent(contentDiv);
            }
          }
        }
      }
    });
  }

  EditPost() {
    this.modalCtrl.dismiss({ edit: true });
    this.nakama.EditPost(this.PostInfo);
  }

  RemovePost() {
    this.alertCtrl.create({
      header: this.lang.text['PostViewer']['RemovePost'],
      message: this.lang.text['ChatRoom']['CannotUndone'],
      buttons: [{
        text: this.lang.text['TodoDetail']['remove'],
        cssClass: 'redfont',
        handler: async () => {
          await this.nakama.RemovePost(this.PostInfo);
          this.modalCtrl.dismiss();
        }
      }],
    }).then(v => v.present());
  }

  ionViewDidLeave() {
    if (this.p5canvas)
      this.p5canvas.remove();
    for (let i = 0, j = this.FileURLs.length; i < j; i++)
      URL.revokeObjectURL(this.FileURLs[i]);
  }
}
