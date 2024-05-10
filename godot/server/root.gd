extends Node


# 이 색깔로 로그 발생시 오류로 처리
const LOG_ERR:= 'faa'

# 이번 부팅의 로그 기록
var rich_log:= '-- Server program started.'
var rich_node:RichTextLabel

# csv 분할자
const SEP_CHAR:= '，'

# 데이터베이스 폴더 경로 with '/'
var root_path:String

# 웹 페이지 경로 with '/'
var html_path:String

# SSL 고유키 설정
var private
var public

func _init(): # 기본 경로 설정
	if OS.is_debug_build():
		root_path = 'res://gd_database/'
		html_path = 'res://'
		var file:= File.new() # 테스트 중인 경우 이 폴더를 프로젝트로부터 무시합니다
		if file.open(root_path + '.gdignore', File.WRITE) == OK:
			file.store_string('gdignore')
			file.flush()
		file.close()
	else: # 서버 실행파일이 위치한 경로로부터
		var only_path:= OS.get_executable_path()
		var index:= only_path.find_last('/')
		only_path = only_path.substr(0, index)
		root_path = only_path + '/gd_database/'
		html_path = only_path + '/'
	# 폴더가 준비되어있지 않으면 생성하기
	var dir:= Directory.new()
	if not dir.dir_exists(root_path):
		dir.make_dir_recursive(root_path)
	# SSL 고유키 불러오기
	if dir.file_exists(html_path + 'private.key'):
		private = load(html_path + 'private.key')
	if dir.file_exists(html_path + 'public.crt'):
		public = load(html_path + 'public.crt')
	logging('Root', 'Display logging ready.', 'aaf')


# 로그처리
func logging(header:String, content:String, _con_col:= 'bbb'):
	var time:= OS.get_datetime()
	var sys_time:= str(OS.get_system_time_msecs())
	var stamp:= '[%04d-%02d-%02d %02d:%02d:%02d.%s] ' % [
		time['year'],
		time['month'],
		time['day'],
		time['hour'],
		time['minute'],
		time['second'],
		sys_time.substr(sys_time.length() - 3)
	] # 오류 여부 검토
	var is_alert:= _con_col == LOG_ERR
	# 로그 생성
	var result:= '%s%s%s | %s' % [
		'*' if is_alert else '', stamp, header, content
	]
	if is_alert:
		printerr(result)
	else: # 일반 로그
		print(result)
	# 로그 노드가 있으면 추가하기
	var result_gui:= '[color=#888]%s[/color][color=#%s]%s[/color] | [color=#bbb]%s[/color]' % [
		stamp, _con_col, header, content
	]
	rich_log += '\n' + result_gui
	if rich_node != null:
		rich_node.bbcode_text = rich_log
