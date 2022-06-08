extends Control
# 회원기입 처리 후 이메일 발송을 위해 돌고 있는 임시 서버
# 향후에 다른 방식으로 사용하긴 해야할텐데 말이지..

var server:= WebSocketServer.new()


func _ready():
	server.connect("data_received", self, '_received')
	var err:= server.listen(8888)
	if err != OK:
		printerr('서버 생성 오류: ', err)


func _received(id:int):
	var err:= server.get_peer(id).get_packet_error()
	if err == OK:
		var raw_data:= server.get_peer(id).get_packet()
		var data:= raw_data.get_string_from_utf8()
		# 해당 입력값으로 이메일 발송처리하기 (Exim4)
		var _time:= OS.get_datetime()
		var _stamp:= '[%04d-%02d-%02d %02d:%02d:%02d]' % [
			_time['year'],
			_time['month'],
			_time['day'],
			_time['hour'],
			_time['minute'],
			_time['second'],
		]
		print(_stamp, ' 이메일 발송처리: ', data)
		var title:= 'Project: Cone | 회원가입 본인 확인용 메일'
		var msg:= '안녕하세요.\n\n직접 회원가입을 요청한 적이 없다면 이 메일을 무시해주세요.\n\n http://is2you2.iptime.org/register?target=%s\n\n위 링크를 눌러 커뮤니티 등록을 마무리해주세요 :)\n\nProject: Cone' % [Marshalls.utf8_to_base64(data).trim_suffix('=')]
		var file:= File.new()
		if file.open('user://sendmail_%s.sh' % [data], File.WRITE) == OK:
			file.store_string('echo -e "%s" | mail -s %s %s' % [msg, '=?utf-8?b?%s?=' % [Marshalls.utf8_to_base64(title)], data])
		file.flush()
		file.close()
		OS.execute('bash', [OS.get_user_data_dir() + '/sendmail_%s.sh' % [data]], true)
		var dir:= Directory.new()
		dir.remove('user://sendmail_%s.sh' % [data])
		# 메시지를 처리한 후 소켓 닫기
		server.disconnect_peer(id, 4000, '이메일 발송 요청 성공함')
	else:
		printerr('패킷 에러: ', err)


func _process(_delta):
	server.poll()


func _exit_tree():
	server.stop()
