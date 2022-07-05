extends Node
# 회원기입 처리 후 이메일 발송용
# 별도 서버로 관리됨 (게스트 모드용)

var server:= WebSocketServer.new()
# 미리 구성된 이메일 안내 폼을 기억하고 있기
var title:= 'Project: Cone | 회원가입 본인 확인용 메일'
var msg:= '안녕하세요.\n\n직접 회원가입을 요청한 적이 없다면 이 메일을 무시해주세요.\n\n http://is2you2.iptime.org/register?target=%s\n\n위 링크를 눌러 커뮤니티 등록을 마무리해주세요 :)\n\nProject: Cone'
const PORT:= 12010
const HEADER:= 'Exim4'

# 메일 인증 토큰 필요
# 발송된 메일들을 관리하고 발송 후 5분이 지나서 진행할 수 없음
var token:= {}

# 시작할 때 설정 파일을 불러오거나 만들어냄
func initialize(_null = null):
	var _path:String = get_parent().get_parent().root_path + 'exim4_send_content.cfg'
	var dir:= Directory.new()
	# 설정 파일이 없으면 기본 정보로 파일 생성하기
	if not dir.file_exists(_path):
		var file:= File.new()
		var err:= file.open(_path, File.WRITE)
		if err == OK: # 파일이 없다면 기본값으로 파일 생성하기
			file.store_string(title + '\n' + msg)
		else: # 정말 극단적으로 왜인지 오류가 난다면
			printerr('Exim send cfg initialize error: ', err)
		file.flush()
		file.close()
	var file:= File.new()
	var err:= file.open(_path, File.READ)
	if err == OK:
		file.seek(0)
		var line:= file.get_line()
		title = line
		msg = ''
		while not file.eof_reached():
			line = file.get_line()
			msg += '\n' + line
	else: # 열람 오류
		Root.logging(HEADER, str('Load send cfg failed: ', err), Root.LOG_ERR)
	file.close()


var thread:= Thread.new()


func _ready():
	server.connect("data_received", self, '_received')
	var err:= server.listen(PORT)
	if err != OK: # 서버 구성 오류
		Root.logging(HEADER, str('init error: ', err), Root.LOG_ERR)
	else: # 정상적으로 서버 열림
		Root.logging(HEADER, str('header opened: ', PORT))
		var ferr:= thread.start(self, 'initialize')
		if ferr != OK:
			initialize()

# email 멘트를 바깥 폴더에서 구성할 수 있어야 함
# 인증 메일 발송과 동시에 인증 제한시간을 측정하여 오랜 시간이 지났을 경우
# 진행할 수 없도록 구성되어야 함 (내 프로젝트에 맞는 방침인지 검토 필요)
func _received(id:int, _try_left:= 5):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		var json = JSON.parse(data).result
		if json is Dictionary:
			match(json):
				{ 'act': 'request' }: # 이메일 발송 요청
					var terr:= thread.start(self, 'execute_send_mail', [id, json['email']])
					if terr != OK:
						execute_send_mail([id, json['email']])
				{ 'act': 'register' }: # 회원가입 페이지 진입시 검토
					print_debug('회원가입 화면에서 진입함: ', json['email'])
				_: # 여기서는 지원하지 않음
					Root.logging(HEADER, str('data mismatch: ', data), Root.LOG_ERR)
		else: # 여기서는 지원하지 않음
			Root.logging(HEADER, str('data mismatch: ', data), Root.LOG_ERR)
	else:
		if _try_left > 0:
			Root.logging(HEADER, str('receive error with try left: ', _try_left))
			yield(get_tree(), "idle_frame")
			_received(id, _try_left -1)
		else:
			Root.logging(HEADER, str('Packet error: ', err), Root.LOG_ERR)
			server.disconnect_peer(id, 1011, 'receive try left out')


# 메일 발송하기
func execute_send_mail(_data:Array):
	# 해당 입력값으로 이메일 발송처리하기 (Exim4)
	Root.logging(HEADER, str('send to: ', _data[1]))
	var file:= File.new()
	if file.open('user://sendmail_%s.sh' % [_data[1]], File.WRITE) == OK:
		file.store_string('echo -e "%s" | mail -s %s %s' % [msg % [Marshalls.utf8_to_base64(_data[1]).trim_suffix('=')], '=?utf-8?b?%s?=' % [Marshalls.utf8_to_base64(title)], _data[1]])
	file.flush()
	file.close()
	Root.logging(HEADER, str('Send_result: ', OS.execute('bash', [OS.get_user_data_dir() + '/sendmail_%s.sh' % [_data[1]]], true)))
	var dir:= Directory.new()
	dir.remove('user://sendmail_%s.sh' % [_data[1]])
	# 메시지를 처리한 후 소켓 닫기
	server.disconnect_peer(_data[0], 4000, 'SendMail Successful')


func _process(_delta):
	server.poll()


func _exit_tree():
	thread.wait_to_finish()
	server.stop()
