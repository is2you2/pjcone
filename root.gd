extends Node


# 이 색깔로 로그 발생시 오류로 처리
const LOG_ERR:= 'faa'
# 이번 부팅의 로그 기록
var rich_log:= 'Logging Ready'
# csv 분할자
const SEP_CHAR:= '，'
# 데이터베이스 폴더 경로 with '/'
var root_path:String
# 웹 페이지 경로 with '/'
var html_path:String

func _init():
	if OS.is_debug_build():
		root_path = 'res://gd_database/'
		html_path = 'res://pjcone_pwa/src/'
		var file:= File.new() # 테스트 중인 경우 이 폴더를 프로젝트로부터 무시합니다
		if file.open(root_path + '.gdignore', File.WRITE):
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


# 로그처리
func logging(header:String, content:String, _con_col:= 'bbb'):
	var time:= OS.get_datetime()
	var stamp:= '[%04d-%02d-%02d %02d:%02d:%02d] ' % [
		time['year'],
		time['month'],
		time['day'],
		time['hour'],
		time['minute'],
		time['second'],
	] # 로그 생성
	var result:= '%s%s | %s' % [
		stamp, header, content
	]
	if _con_col == LOG_ERR:
		printerr(result)
	else: # 일반 로그
		print(result)
	# 로그 노드가 있으면 추가하기
	if rich_log != null:
		var result_gui:= '%s[color=#%s]%s[/color] | %s' % [
			stamp, header, _con_col, content
		]
		rich_log += '\n' + result_gui
